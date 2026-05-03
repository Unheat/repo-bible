/**
 * Typed RPC client for the backend methods. The frontend uses the
 * camelCase export names, NOT the kebab-case manifest IDs.
 */
import { createClient } from '@mindstudio-ai/interface';

// ── Backend response shapes (kept in sync with method return types) ──

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

interface ApiContract {
  ingestRepository(input: { githubUrl: string }): Promise<{
    repositoryId: string;
    repoName: string;
    defaultBranch: string;
    status: 'processing';
  }>;

  generateBible(input: { repositoryId: string }): Promise<{
    repositoryId: string;
    repoName: string;
    docsStatus: 'generating';
  }>;

  listRepositories(): Promise<{ repositories: RepoSummary[] }>;

  getRepositoryDetail(input: { repositoryId: string }): Promise<RepositoryDetail>;

  openDocumentationPR(input: { repositoryId: string }): Promise<{
    prUrl: string;
    prNumber: number;
    branch: string;
    fileCount: number;
  }>;
}

export const api = createClient<ApiContract>();
