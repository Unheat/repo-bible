import { Repositories } from './tables/repositories';
import { Files } from './tables/files';
import { GeneratedDocs } from './tables/generatedDocs';
import { db } from '@mindstudio-ai/agent';

interface GetRepositoryDetailInput {
  repositoryId: string;
}

interface FileSummary {
  id: string;
  filePath: string;
  language: string;
  /** True if a file_deepdive doc exists for this file. */
  hasDoc: boolean;
}

interface OverviewDoc {
  id: string;
  markdownContent: string;
  /** Unix-ms when this doc was generated. */
  createdAt: number;
}

interface FileDoc {
  id: string;
  fileId: string;
  markdownContent: string;
  createdAt: number;
}

interface RepositoryDetail {
  id: string;
  githubUrl: string;
  repoName: string;
  status: string;
  docsStatus: string;
  lastScannedAt: number | null;
  files: FileSummary[];
  /** Latest repo_overview by created_at, or null. */
  overview: OverviewDoc | null;
  /** Map of fileId → latest file_deepdive doc. Object so it serializes cleanly. */
  fileDocsByFileId: Record<string, FileDoc>;
}

/**
 * Detail view for one repository. Used by the Dashboard to render the
 * file tree + reading pane in a single round trip. Returns the LATEST
 * `repo_overview` row and the LATEST `file_deepdive` row per file
 * (older generations are dropped from the response).
 */
export async function getRepositoryDetail(
  input: GetRepositoryDetailInput,
): Promise<RepositoryDetail> {
  const repo = await Repositories.get(input.repositoryId);
  if (!repo) throw new Error('Repository not found.');

  const [files, allDocs] = await db.batch(
    Files.filter(
      (f, $) => f.repoId === $.repoId,
      { repoId: repo.id }, // bindings: lifts closure var so filter compiles to SQL
    ),
    GeneratedDocs.filter(
      (d, $) => d.repoId === $.repoId,
      { repoId: repo.id }, // bindings: lifts closure var so filter compiles to SQL
    ),
  );

  // Latest-by-created_at selection.
  let latestOverview: OverviewDoc | null = null;
  const latestByFileId = new Map<string, FileDoc>();

  for (const d of allDocs as Array<{
    id: string;
    repoId: string;
    fileId?: string | null;
    docType: string;
    markdownContent: string;
    created_at: number;
  }>) {
    if (d.docType === 'repo_overview') {
      if (!latestOverview || d.created_at > latestOverview.createdAt) {
        latestOverview = {
          id: d.id,
          markdownContent: d.markdownContent,
          createdAt: d.created_at,
        };
      }
    } else if (d.docType === 'file_deepdive' && d.fileId) {
      const existing = latestByFileId.get(d.fileId);
      if (!existing || d.created_at > existing.createdAt) {
        latestByFileId.set(d.fileId, {
          id: d.id,
          fileId: d.fileId,
          markdownContent: d.markdownContent,
          createdAt: d.created_at,
        });
      }
    }
  }

  // Build file summaries — alphabetical for stable tree rendering.
  const fileSummaries: FileSummary[] = (files as Array<{
    id: string;
    filePath: string;
    language: string;
  }>)
    .map((f) => ({
      id: f.id,
      filePath: f.filePath,
      language: f.language,
      hasDoc: latestByFileId.has(f.id),
    }))
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  // Map → Record for JSON serialization.
  const fileDocsByFileId: Record<string, FileDoc> = {};
  for (const [fileId, doc] of latestByFileId) {
    fileDocsByFileId[fileId] = doc;
  }

  return {
    id: repo.id,
    githubUrl: repo.githubUrl,
    repoName: repo.repoName,
    status: repo.status,
    docsStatus: repo.docsStatus ?? 'idle',
    lastScannedAt: repo.lastScannedAt ?? null,
    files: fileSummaries,
    overview: latestOverview,
    fileDocsByFileId,
  };
}
