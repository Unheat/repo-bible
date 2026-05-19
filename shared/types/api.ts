/**
 * Shared API types between frontend and backend.
 * These interfaces define the contract for REST API communication.
 */

// ── Repository Types ──

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

export interface FileSummary {
  id: string;
  filePath: string;
  language: string;
  hasDoc: boolean;
}

export interface OverviewDoc {
  id: string;
  markdownContent: string;
  createdAt: number;
}

export interface FileDoc {
  id: string;
  fileId: string;
  markdownContent: string;
  createdAt: number;
}

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

// ── API Request/Response Types ──

export interface IngestRepositoryRequest {
  githubUrl: string;
}

export interface IngestRepositoryResponse {
  repositoryId: string;
  repoName: string;
  defaultBranch: string;
  status: 'processing';
}

export interface GenerateBibleRequest {
  repositoryId: string;
}

export interface GenerateBibleResponse {
  repositoryId: string;
  repoName: string;
  docsStatus: 'generating';
}

export interface ListRepositoriesResponse {
  repositories: RepoSummary[];
}

export interface GetRepositoryDetailRequest {
  repositoryId: string;
}

export interface OpenDocumentationPRRequest {
  repositoryId: string;
}

export interface OpenDocumentationPRResponse {
  prUrl: string;
  prNumber: number;
  branch: string;
  fileCount: number;
}

export interface DeleteRepositoryRequest {
  repositoryId: string;
}

export interface DeleteRepositoryResponse {
  success: true;
  repositoryId: string;
  repoName: string;
}

// ── Error Response Type ──

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// Made with Bob
