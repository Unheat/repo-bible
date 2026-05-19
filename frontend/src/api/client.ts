/**
 * Codebase Bible - Frontend API Client
 *
 * Standard fetch-based REST API calls to the Express backend.
 * Uses shared types from ../../../shared/types/api.ts for type safety.
 */

import type {
  IngestRepositoryRequest,
  IngestRepositoryResponse,
  ListRepositoriesResponse,
  RepositoryDetail,
  GenerateBibleRequest,
  GenerateBibleResponse,
  OpenDocumentationPRRequest,
  OpenDocumentationPRResponse,
} from '../../../shared/types/api';

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
// API CLIENT OBJECT
// ============================================================================

export const api = {
  /**
   * List all repositories
   */
  listRepositories: async (): Promise<ListRepositoriesResponse> => {
    return apiFetch<ListRepositoriesResponse>('/repositories');
  },

  /**
   * Ingest a GitHub repository
   */
  ingestRepository: async (input: IngestRepositoryRequest): Promise<IngestRepositoryResponse> => {
    return apiFetch<IngestRepositoryResponse>('/repositories/ingest', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Get repository details including files and documentation
   */
  getRepositoryDetail: async (input: { repositoryId: string }): Promise<RepositoryDetail> => {
    return apiFetch<RepositoryDetail>(`/repositories/${input.repositoryId}`);
  },

  /**
   * Generate AI documentation for a repository
   */
  generateBible: async (input: GenerateBibleRequest): Promise<GenerateBibleResponse> => {
    return apiFetch<GenerateBibleResponse>(`/repositories/${input.repositoryId}/generate`, {
      method: 'POST',
    });
  },

  /**
   * Open a pull request with generated documentation
   */
  openDocumentationPR: async (input: OpenDocumentationPRRequest): Promise<OpenDocumentationPRResponse> => {
    return apiFetch<OpenDocumentationPRResponse>(`/repositories/${input.repositoryId}/pr`, {
      method: 'POST',
    });
  },
};

// Made with Bob
