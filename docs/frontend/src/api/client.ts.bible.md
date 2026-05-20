### 1. File Purpose
This file implements the frontend API client, providing a typed, fetch-based interface for communicating with the backend Express API. It abstracts HTTP requests into a set of named functions that correspond to backend endpoints, ensuring type safety through shared TypeScript types and handling common request/response patterns, including error propagation.

### 2. Architecture and Design Patterns
This file follows a **service layer pattern** on the client side, acting as a dedicated abstraction over raw HTTP calls. It uses a **facade pattern** via the exported `api` object, which consolidates related API operations. The client is tightly coupled to the backend's REST API design, as defined in `backend/src/routes/api.ts`, and relies on shared type definitions from `shared/types/api.ts` for contract enforcement. It fits into the broader client-server architecture by serving as the sole communication layer between the React frontend and the backend services.

### 3. Public Interface
The file exports a single object `api` containing the following methods:

```typescript
listRepositories: async (): Promise<ListRepositoriesResponse>
```
- **Purpose**: Fetches a list of all ingested repositories.
- **Return Type**: `Promise<ListRepositoriesResponse>` from shared types.

```typescript
ingestRepository: async (input: IngestRepositoryRequest): Promise<IngestRepositoryResponse>
```
- **Purpose**: Initiates ingestion of a GitHub repository via a POST request.
- **Parameters**: `input: IngestRepositoryRequest` (shared type).
- **Return Type**: `Promise<IngestRepositoryResponse>` from shared types.

```typescript
getRepositoryDetail: async (input: { repositoryId: string }): Promise<RepositoryDetail>
```
- **Purpose**: Retrieves detailed information for a specific repository, including files and documentation.
- **Parameters**: `input: { repositoryId: string }`.
- **Return Type**: `Promise<RepositoryDetail>` from shared types.

```typescript
generateBible: async (input: GenerateBibleRequest): Promise<GenerateBibleResponse>
```
- **Purpose**: Triggers AI documentation generation for a repository.
- **Parameters**: `input: GenerateBibleRequest` (shared type).
- **Return Type**: `Promise<GenerateBibleResponse>` from shared types.

```typescript
openDocumentationPR: async (input: OpenDocumentationPRRequest): Promise<OpenDocumentationPRResponse>
```
- **Purpose**: Opens a pull request with generated documentation.
- **Parameters**: `input: OpenDocumentationPRRequest` (shared type).
- **Return Type**: `Promise<OpenDocumentationPRResponse>` from shared types.

```typescript
deleteRepository: async (input: DeleteRepositoryRequest): Promise<DeleteRepositoryResponse>
```
- **Purpose**: Deletes a repository and all related data.
- **Parameters**: `input: DeleteRepositoryRequest` (shared type).
- **Return Type**: `Promise<DeleteRepositoryResponse>` from shared types.

```typescript
updateDocumentation: async (repositoryId: string, docId: string, content: string): Promise<{ success: boolean; document: any }>
```
- **Purpose**: Updates the content of a specific documentation document.
- **Parameters**: `repositoryId: string`, `docId: string`, `content: string`.
- **Return Type**: `Promise<{ success: boolean; document: any }>` (untyped response).

### 4. Internal Logic Walkthrough
The core internal logic is the `apiFetch` helper function, which wraps the browser's `fetch` API with standardized error handling and JSON parsing.

1.  **URL Construction**: The function constructs the full URL by combining `API_BASE_URL` (derived from an environment variable or a default) with the provided endpoint.
    ```typescript
    const url = `${API_BASE_URL}${endpoint}`;
    ```
2.  **Request Execution**: It calls `fetch` with merged options, ensuring the `Content-Type` header is set to `application/json`.
    ```typescript
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    ```
3.  **Error Handling**: If the response is not OK (status outside 200-299), it attempts to parse the error JSON. If parsing fails, it falls back to a generic error object. It then throws an `Error` with the message from the parsed error or a default status text.
    ```typescript
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: 'Unknown Error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      }));

      throw new Error(error.message || `Request failed with status ${response.status}`);
    }
    ```
4.  **Response Parsing**: On success, it parses the response body as JSON and returns it.
    ```typescript
    return response.json();
    ```
5.  **Catch Block**: Any runtime errors (e.g., network failures) are caught and re-thrown as `Error` instances for consistency.
    ```typescript
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred');
    }
    ```

The exported `api` object methods each call `apiFetch` with specific endpoints and HTTP methods, leveraging the shared types for request and response shapes.

### 5. Dependencies and Integrations
- **Internal Imports**:
  - `../../../shared/types/api.ts`: Provides TypeScript interfaces for all request and response payloads (`IngestRepositoryRequest`, `ListRepositoriesResponse`, etc.). This ensures type safety between frontend and backend.
- **External Dependencies**:
  - `import.meta.env.VITE_API_URL`: Environment variable provided by Vite (the frontend build tool) to configure the backend API base URL. The code defaults to `http://localhost:3000/api` if not set.
  - Browser `fetch` API: Used for all HTTP requests. No external HTTP library is used.

### 6. Edge Cases and Error Handling
- **Network/HTTP Errors**: The `apiFetch` function catches any errors during the `fetch` call and throws a standardized `Error` object.
- **Non-OK HTTP Responses**: The function checks `response.ok`. If false, it attempts to parse a JSON error response from the server. If JSON parsing fails, it constructs a generic error message using the HTTP status and status text.
- **Missing Environment Variable**: The `API_BASE_URL` falls back to a localhost default if `import.meta.env.VITE_API_URL` is undefined, ensuring the client works in development without explicit configuration.
- **Generic Error Fallback**: In the catch block, if the error is not an `Error` instance, it throws a new `Error` with a generic message to maintain consistent error types.

### 7. Observations
- **Untyped Response in `updateDocumentation`**: The `updateDocumentation` method returns `Promise<{ success: boolean; document: any }>`. The `document: any` type bypasses TypeScript's type safety, which could lead to runtime errors. This contrasts with other methods that use strictly typed shared interfaces.
- **Hardcoded API Path**: The API base URL is hardcoded to `/api` in the default fallback. This assumes the backend is mounted at this path, which should be verified against the backend server configuration.
- **Error Message Exposure**: The error handling exposes raw error messages from the server response (`error.message`). While useful for debugging, this might leak internal details in production if the backend returns sensitive information in error payloads.
- **No Request Timeout**: The `fetch` call does not specify a timeout, which could lead to hanging requests in poor network conditions.