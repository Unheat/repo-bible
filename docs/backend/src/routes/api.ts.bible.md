### 1. File Purpose
This file defines the REST API routes for the Codebase Bible backend, acting as the primary entry point for all HTTP requests from the frontend. It wraps the service layer (e.g., `ingestRepository`, `generateBible`) to handle repository ingestion, documentation generation, CRUD operations, and utility endpoints, replacing a previous proprietary RPC system.

### 2. Architecture and Design Patterns
This file follows the **router pattern** (Express.js Router) to organize endpoints by resource (repositories, documentation). It fits into the broader layered monolithic architecture as the presentation layer, delegating business logic to the service layer (e.g., `../services/ingestRepository.js`). It uses a **service facade pattern** where each route handler calls a single service function, promoting separation of concerns. The architecture is event-driven for async operations (e.g., ingestion and generation), but this file itself is synchronous and request/response-oriented.

### 3. Public Interface
The file exports a single `apiRouter` instance, which is an Express Router. All endpoints are mounted on this router.

```typescript
export const apiRouter: Router;
```

**Endpoints:**
- `POST /api/repositories/ingest`
  - Signature: `async (req: Request, res: Response) => void`
  - Parameters: `req.body: { githubUrl: string }`
  - Returns: JSON with `{ repositoryId, repoName, defaultBranch, status: 'processing' }` or error.
  - Purpose: Initiates ingestion of a GitHub repository.

- `GET /api/repositories`
  - Signature: `async (_req: Request, res: Response) => void`
  - Parameters: None (query params not used).
  - Returns: JSON with `{ repositories: Repository[] }` or error.
  - Purpose: Lists all ingested repositories.

- `GET /api/repositories/:id`
  - Signature: `async (req: Request, res: Response) => void`
  - Parameters: `req.params: { id: string }`
  - Returns: JSON with `{ repository, files, documentation }` or error.
  - Purpose: Fetches details for a specific repository, including files and generated docs.

- `DELETE /api/repositories/:id`
  - Signature: `async (req: Request, res: Response) => void`
  - Parameters: `req.params: { id: string }`
  - Returns: JSON with `{ success: true, repositoryId: string, repoName: string }` or error.
  - Purpose: Deletes a repository and all related data.

- `PUT /api/repositories/:id/docs/:docId`
  - Signature: `async (req: Request, res: Response) => void`
  - Parameters: `req.params: { id: string, docId: string }`, `req.body: { content: string }`
  - Returns: JSON with `{ success: true, document: GeneratedDoc }` or error.
  - Purpose: Updates the content of a specific generated document.

- `POST /api/repositories/:id/generate`
  - Signature: `async (req: Request, res: Response) => void`
  - Parameters: `req.params: { id: string }`
  - Returns: JSON with `{ status: 'generating', message: string }` or error.
  - Purpose: Triggers AI documentation generation for a repository.

- `POST /api/repositories/:id/pr`
  - Signature: `async (req: Request, res: Response) => void`
  - Parameters: `req.params: { id: string }`, `req.body: { branchName?: string }` (body not used in code)
  - Returns: JSON with `{ prUrl: string, branchName: string }` or error.
  - Purpose: Opens a pull request with generated documentation.

- `GET /api/status`
  - Signature: `async (_req: Request, res: Response) => void`
  - Parameters: None.
  - Returns: JSON with status, version, environment, and feature flags.
  - Purpose: Provides API health and configuration status.

### 4. Internal Logic Walkthrough
The file primarily routes requests to service functions with input validation and error handling. Non-trivial logic includes:

1. **Input Validation**: Each endpoint validates required parameters (e.g., `githubUrl`, `id`) and returns 400 errors if missing or invalid. For example:
   ```typescript
   if (!githubUrl || typeof githubUrl !== 'string') {
     return res.status(400).json({
       error: 'Bad Request',
       message: 'githubUrl is required and must be a string',
     });
   }
   ```

2. **Error Handling**: All endpoints use try-catch blocks, logging errors and returning 500 status codes. Some endpoints handle specific cases, like 404 for "not found" errors:
   ```typescript
   if (error.message?.includes('not found')) {
     return res.status(404).json({
       error: 'Not Found',
       message: error.message,
     });
   }
   ```

3. **Document Update Logic**: The `PUT /repositories/:id/docs/:docId` endpoint includes additional checks to verify document ownership before updating:
   - Imports Prisma client dynamically: `const { prisma } = await import('../db/prisma.js');`
   - Checks if the document exists and belongs to the repository:
     ```typescript
     const existingDoc = await prisma.generatedDoc.findUnique({
       where: { id: docId },
     });
     if (!existingDoc) { /* return 404 */ }
     if (existingDoc.repoId !== id) { /* return 403 */ }
     ```
   - Updates the document with new content and timestamp:
     ```typescript
     const updatedDoc = await prisma.generatedDoc.update({
       where: { id: docId },
       data: {
         markdownContent: content,
         updatedAt: new Date(),
       },
     });
     ```

4. **Status Endpoint**: Returns static configuration based on environment variables, indicating feature availability (e.g., GitHub integration if `GITHUB_TOKEN` is set).

### 5. Dependencies and Integrations
- **Imports from `express`**: Provides `Router`, `Request`, and `Response` types for defining routes and handling HTTP requests.
- **Internal Services**:
  - `../services/ingestRepository.js`: Handles repository ingestion logic (implementation not in scope).
  - `../services/generateBible.js`: Triggers documentation generation (implementation not in scope).
  - `../services/listRepositories.js`: Fetches repository list (implementation not in scope).
  - `../services/getRepositoryDetail.js`: Fetches repository details (implementation not in scope).
  - `../services/openDocumentationPR.js`: Opens pull requests (implementation not in scope).
  - `../services/deleteRepository.js`: Deletes repositories (implementation not in scope).
- **Internal Database**: Dynamically imports `../db/prisma.js` for Prisma ORM operations in the document update endpoint (implementation not in scope).

### 6. Edge Cases and Error Handling
- **Missing Parameters**: All endpoints validate required params (e.g., `githubUrl`, `id`, `docId`, `content`) and return 400 errors with descriptive messages.
- **Not Found Cases**: The `GET /repositories/:id` and `DELETE /repositories/:id` endpoints handle "not found" errors by checking error messages and returning 404.
- **Ownership Validation**: The `PUT /repositories/:id/docs/:docId` endpoint checks if the document belongs to the repository, returning 403 if not.
- **Generic Error Fallback**: All endpoints catch unhandled errors and return 500 with a generic message, logging the error to console.
- **Dynamic Import**: The Prisma client is imported dynamically in the document update endpoint to avoid top-level import issues, but this could introduce latency or errors if the module is unavailable.

### 7. Observations
- **Code Duplication**: The error handling and validation logic is repeated across endpoints, suggesting a potential refactor into middleware or helper functions.
- **Unused Body Parameter**: The `POST /repositories/:id/pr` endpoint accepts a `branchName` in the request body but does not use it in the service call, which may indicate incomplete implementation.
- **Dynamic Import in Route Handler**: Importing Prisma dynamically within a route handler is unconventional and could lead to performance issues or errors; it might be better to import at the top level or use a dependency injection pattern.
- **Truncation Note**: The source code ends with a duplicate `generateBible` endpoint block and a comment "Made with Bob," but no `[... truncated ...]` marker is present; the analysis is based on the visible code.