### 1. File Purpose
This file defines the shared TypeScript type interfaces for the REST API contract between the frontend and backend of the Unheat/repo-bible system. It establishes the data structures for repository summaries, file summaries, documentation objects, and all API request/response payloads, ensuring type safety and consistent communication across the client-server boundary.

### 2. Architecture and Design Patterns
This file is a **type definition module** that follows the **shared types pattern** in a monolithic or monorepo architecture. It does not contain implementation logic but serves as a contract layer. It fits into the broader architecture by providing the foundational data models used by the backend API routes (e.g., `api.ts`) and the frontend API client (`client.ts`), enabling compile-time validation of API interactions. No behavioral design patterns (e.g., factory, repository) are present, as this is purely a declarative type file.

### 3. Public Interface
All exported interfaces are documented below. No functions, classes, or constants are exported.

```typescript
export interface RepoSummary {
  id: string;
  githubUrl: string;
  repoName: string;
  status: string;
  docsStatus: string;
  lastScannedAt: number | null;
  fileCount: number;
  hasOverview: boolean;
  documentedFileCount: number;
  updatedAt: number;
}
```
Purpose: Summarizes a repository's metadata and processing status for list views.

```typescript
export interface FileSummary {
  id: string;
  filePath: string;
  language: string;
  hasDoc: boolean;
}
```
Purpose: Summarizes a file's metadata within a repository.

```typescript
export interface OverviewDoc {
  id: string;
  markdownContent: string;
  createdAt: number;
}
```
Purpose: Represents a generated overview document for a repository.

```typescript
export interface FileDoc {
  id: string;
  fileId: string;
  markdownContent: string;
  createdAt: number;
}
```
Purpose: Represents a generated documentation file for a specific code file.

```typescript
export interface RepositoryDetail {
  id: string;
  githubUrl: string;
  repoName: string;
  status: string;
  docsStatus: string;
  lastScannedAt: number | null;
  files: FileSummary[];
  overview: OverviewDoc | null;
  fileDocsByFileId: Record<string, FileDoc>;
}
```
Purpose: Provides detailed repository information, including files and associated documentation.

```typescript
export interface IngestRepositoryRequest {
  githubUrl: string;
}
```
Purpose: Request payload for initiating repository ingestion.

```typescript
export interface IngestRepositoryResponse {
  repositoryId: string;
  repoName: string;
  defaultBranch: string;
  status: 'processing';
}
```
Purpose: Response payload confirming repository ingestion has started.

```typescript
export interface GenerateBibleRequest {
  repositoryId: string;
}
```
Purpose: Request payload for triggering documentation generation.

```typescript
export interface GenerateBibleResponse {
  repositoryId: string;
  repoName: string;
  docsStatus: 'generating';
}
```
Purpose: Response payload confirming documentation generation has started.

```typescript
export interface ListRepositoriesResponse {
  repositories: RepoSummary[];
}
```
Purpose: Response payload containing a list of repository summaries.

```typescript
export interface GetRepositoryDetailRequest {
  repositoryId: string;
}
```
Purpose: Request payload for fetching detailed repository information.

```typescript
export interface OpenDocumentationPRRequest {
  repositoryId: string;
}
```
Purpose: Request payload for opening a documentation pull request.

```typescript
export interface OpenDocumentationPRResponse {
  prUrl: string;
  prNumber: number;
  branch: string;
  fileCount: number;
}
```
Purpose: Response payload with details of the opened documentation PR.

```typescript
export interface DeleteRepositoryRequest {
  repositoryId: string;
}
```
Purpose: Request payload for deleting a repository.

```typescript
export interface DeleteRepositoryResponse {
  success: true;
  repositoryId: string;
  repoName: string;
}
```
Purpose: Response payload confirming repository deletion.

```typescript
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
```
Purpose: Standardized error response structure for API failures.

### 4. Internal Logic Walkthrough
This file contains no internal logic, algorithms, or control flow. It solely defines TypeScript interfaces with static type declarations. There are no executable statements, conditionals, or data transformations. The "why" behind the structure is to enforce a strict contract for API communication, as evidenced by the comment at the top: "These interfaces define the contract for REST API communication."

### 5. Dependencies and Integrations
- **No imports or requires**: This file has no external or internal dependencies. It is a self-contained type definition module.
- **Integration**: This file is imported by other modules in the codebase (e.g., backend API routes and frontend API client) to ensure type consistency. The implementation of those modules is not in scope for this analysis.

### 6. Edge Cases and Error Handling
This file defines no runtime logic, so there are no error paths, guards, or fallbacks. The `ApiError` interface provides a standardized structure for error responses, but its usage is not implemented here.

### 7. Observations
- The file includes a non-standard comment: `// Made with Bob`, which may indicate a tool or author attribution but has no functional impact.
- All interfaces use `number` for timestamps (e.g., `lastScannedAt`, `createdAt`), which likely represents Unix timestamps in milliseconds; this should be consistent across the system.
- The `status` and `docsStatus` fields in `RepoSummary` and `RepositoryDetail` are typed as `string`, but specific literal types (e.g., `'processing'`, `'generating'`) are used in some response interfaces. This could lead to inconsistency; consider using enums or union types for better type safety.