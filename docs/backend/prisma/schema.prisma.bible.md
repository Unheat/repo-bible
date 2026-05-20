### 1. File Purpose
This file defines the database schema for the Unheat/repo-bible system using Prisma ORM. It establishes the data models for repositories, files, code chunks, and generated documentation, providing the structural foundation for storing ingested repository data, processed code units, and AI-generated documentation. The schema replaces a proprietary agent database system with a standard SQLite-backed Prisma implementation.

### 2. Architecture and Design Patterns
This schema file implements a **data persistence layer** within the layered monolithic architecture. It uses Prisma's declarative schema definition to model the system's core entities and their relationships. The design follows a **relational data model** pattern with clear foreign key constraints and cascade deletions. It fits into the broader architecture as the database layer that services like `ingestRepository.ts` and `generateBible.ts` interact with via Prisma's generated client. The schema enforces data integrity through unique constraints (e.g., `@@unique([repoId, filePath])`) and lifecycle tracking via status fields.

### 3. Public Interface
This file does not export functions, classes, or types directly. It defines Prisma models that are used by the Prisma Client generated from this schema. The models are:

```prisma
model Repository {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  githubUrl String @unique @map("github_url")
  repoName String @map("repo_name")
  status String @default("pending")
  docsStatus String? @default("idle") @map("docs_status")
  lastScannedAt BigInt? @map("last_scanned_at")
  files         File[]
  generatedDocs GeneratedDoc[]
}
```
Purpose: Tracks GitHub repositories added to the system, their ingestion status, and documentation generation status.

```prisma
model File {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  repoId String @map("repo_id")
  filePath String @map("file_path")
  language String
  repository    Repository     @relation(fields: [repoId], references: [id], onDelete: Cascade)
  codeChunks    CodeChunk[]
  generatedDocs GeneratedDoc[]
}
```
Purpose: Represents a single source file within a repository, storing its path and detected language.

```prisma
model CodeChunk {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  fileId String @map("file_id")
  chunkText String @map("chunk_text")
  chunkType String @map("chunk_type")
  embedding String
  file File @relation(fields: [fileId], references: [id], onDelete: Cascade)
}
```
Purpose: Stores semantic units extracted from files, including source text, type category, and embedding vectors for search.

```prisma
model GeneratedDoc {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  repoId String @map("repo_id")
  fileId String? @map("file_id")
  docType String @map("doc_type")
  markdownContent String @map("markdown_content")
  repository Repository @relation(fields: [repoId], references: [id], onDelete: Cascade)
  file       File?      @relation(fields: [fileId], references: [id], onDelete: Cascade)
}
```
Purpose: Stores AI-generated markdown documentation, distinguishing between repository overviews and file deep-dives.

### 4. Internal Logic Walkthrough
The schema defines four interconnected models with explicit relationships and constraints:

1. **Repository Model**: Acts as the root entity. The `githubUrl` field is marked `@unique` to ensure each repository is added only once. The `status` and `docsStatus` fields track lifecycle states (e.g., `'pending'`, `'processing'`, `'completed'`, `'failed'`). The `lastScannedAt` field is a Unix timestamp updated only on successful ingestion.

2. **File Model**: Each file is owned by exactly one repository via the `repoId` foreign key. The `@@unique([repoId, filePath])` constraint ensures a file path appears at most once per repository. Cascade deletion is configured so deleting a repository removes all its files.

3. **CodeChunk Model**: Each chunk belongs to a file via the `fileId` foreign key, with cascade deletion. The `chunkType` field uses a fixed set of values (e.g., `"function"`, `"class"`) as documented in the comments. The `embedding` field stores a JSON string of floats for vector search, with length dependent on the embedding model.

4. **GeneratedDoc Model**: This model has a discriminator field `docType` to differentiate between `'repo_overview'` and `'file_deepdive'`. The `fileId` is optional, allowing repository-level docs without a specific file. Both `repoId` and `fileId` have cascade deletion relations.

```prisma
// Example constraint from File model
@@unique([repoId, filePath], name: "unique_repo_file")
```

### 5. Dependencies and Integrations
- **Prisma Client JS**: Generated by the `generator client` block, output to `../src/generated/prisma`. This provides the TypeScript client for database operations.
- **SQLite**: The datasource uses SQLite, configured via the `DATABASE_URL` environment variable. This is a lightweight, file-based database suitable for development and small-scale deployment.
- **Internal Models**: The models reference each other (e.g., `Repository` has `files` and `generatedDocs` arrays). These relationships are enforced by Prisma's relation fields and cascade deletions.
- **No External Libraries**: The schema itself has no runtime dependencies; it relies on Prisma's tooling for generation and migration.

### 6. Edge Cases and Error Handling
- **Cascade Deletion**: Configured on all relations (e.g., `onDelete: Cascade`) to maintain referential integrity. Deleting a repository automatically removes associated files, code chunks, and generated docs.
- **Optional Fields**: `docsStatus` and `fileId` in `GeneratedDoc` are optional, allowing for states where documentation hasn't been generated or isn't file-specific.
- **Unique Constraints**: The `@@unique` constraint on `Repository.githubUrl` prevents duplicate repositories. The `@@unique([repoId, filePath])` constraint on `File` prevents duplicate file entries per repository.
- **Status Tracking**: The `status` and `docsStatus` fields use string enums (documented in comments) but are not enforced at the database level, relying on application logic to set valid values.
- **No Explicit Error Handling**: The schema itself doesn't handle errors; this is delegated to the Prisma client and application code.

### 7. Observations
- **Duplicate Code Block**: The source code contains a duplicated section for the `CodeChunk` model (lines 60-75 and 76-89). This appears to be a copy-paste error in the provided source, but the schema is functionally identical in both instances.
- **Status Field Enums**: The `status` and `docsStatus` fields use string values with documented enums, but Prisma doesn't enforce these as true enums. This could lead to invalid states if the application doesn't validate inputs.
- **Embedding Storage**: The `embedding` field stores JSON strings, which may require parsing at runtime. This is efficient for SQLite but could impact performance for large-scale vector searches.
- **No Soft Deletes**: The schema uses hard deletes via cascade deletion. If soft deletes are needed, additional fields like `deletedAt` would be required.
- **Timestamp Precision**: `lastScannedAt` uses `BigInt` for Unix milliseconds, which is appropriate for high precision but may need conversion in application code.