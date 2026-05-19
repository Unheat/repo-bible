/**
 * Codebase Bible - Frontend API Client
 * 
 * Replaces the proprietary @mindstudio-ai/interface RPC client with
 * standard fetch-based REST API calls to the Express backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Base fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: 'Unknown Error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      }));

      throw new Error(error.message || `Request failed with status ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred');
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Repository {
  id: string;
  createdAt: string;
  updatedAt: string;
  githubUrl: string;
  repoName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  docsStatus?: 'idle' | 'generating' | 'completed' | 'failed';
  lastScannedAt?: number;
}

export interface File {
  id: string;
  createdAt: string;
  updatedAt: string;
  repoId: string;
  filePath: string;
  language: string;
}

export interface GeneratedDoc {
  id: string;
  createdAt: string;
  updatedAt: string;
  repoId: string;
  fileId?: string;
  docType: 'repo_overview' | 'file_deepdive';
  markdownContent: string;
}

// ============================================================================
// API METHODS
// ============================================================================

/**
 * Ingest a GitHub repository
 */
export async function ingestRepository(githubUrl: string) {
  return apiFetch<{
    repositoryId: string;
    repoName: string;
    defaultBranch: string;
    status: 'processing';
  }>('/repositories/ingest', {
    method: 'POST',
    body: JSON.stringify({ githubUrl }),
  });
}

/**
 * List all repositories
 */
export async function listRepositories() {
  return apiFetch<{
    repositories: Repository[];
  }>('/repositories');
}

/**
 * Get repository details including files and documentation
 */
export async function getRepositoryDetail(repositoryId: string) {
  return apiFetch<{
    repository: Repository;
    files: File[];
    documentation: {
      overview?: GeneratedDoc;
      fileDeepDives: Record<string, GeneratedDoc>;
    };
  }>(`/repositories/${repositoryId}`);
}

/**
 * Generate AI documentation for a repository
 */
export async function generateBible(repositoryId: string) {
  return apiFetch<{
    status: 'generating';
    message: string;
  }>(`/repositories/${repositoryId}/generate`, {
    method: 'POST',
  });
}

/**
 * Open a pull request with generated documentation
 */
export async function openDocumentationPR(repositoryId: string) {
  return apiFetch<{
    prUrl: string;
    prNumber: number;
    branch: string;
    fileCount: number;
  }>(`/repositories/${repositoryId}/pr`, {
    method: 'POST',
  });
}

/**
 * Get API status and configuration
 */
export async function getApiStatus() {
  return apiFetch<{
    status: string;
    version: string;
    environment: string;
    features: {
      githubIntegration: boolean;
      openaiEmbeddings: boolean;
      openrouterLLM: boolean;
    };
  }>('/status');
}

/**
 * Health check
 */
export async function healthCheck() {
  const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
  return response.json();
}

// Made with Bob
