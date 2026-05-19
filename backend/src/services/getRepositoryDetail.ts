import { prisma } from '../db/prisma.js';

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
  const repo = await prisma.repository.findUnique({
    where: { id: input.repositoryId },
  });
  
  if (!repo) throw new Error('Repository not found.');

  const [files, allDocs] = await Promise.all([
    prisma.file.findMany({
      where: { repoId: repo.id },
      select: {
        id: true,
        filePath: true,
        language: true,
      },
    }),
    prisma.generatedDoc.findMany({
      where: { repoId: repo.id },
      select: {
        id: true,
        repoId: true,
        fileId: true,
        docType: true,
        markdownContent: true,
        createdAt: true,
      },
    }),
  ]);

  // Latest-by-created_at selection.
  let latestOverview: OverviewDoc | null = null;
  const latestByFileId = new Map<string, FileDoc>();

  for (const d of allDocs) {
    if (d.docType === 'repo_overview') {
      const createdAtMs = d.createdAt.getTime();
      if (!latestOverview || createdAtMs > latestOverview.createdAt) {
        latestOverview = {
          id: d.id,
          markdownContent: d.markdownContent,
          createdAt: createdAtMs,
        };
      }
    } else if (d.docType === 'file_deepdive' && d.fileId) {
      const createdAtMs = d.createdAt.getTime();
      const existing = latestByFileId.get(d.fileId);
      if (!existing || createdAtMs > existing.createdAt) {
        latestByFileId.set(d.fileId, {
          id: d.id,
          fileId: d.fileId,
          markdownContent: d.markdownContent,
          createdAt: createdAtMs,
        });
      }
    }
  }

  // Build file summaries — alphabetical for stable tree rendering.
  const fileSummaries: FileSummary[] = files
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
    lastScannedAt: repo.lastScannedAt ? Number(repo.lastScannedAt) : null,
    files: fileSummaries,
    overview: latestOverview,
    fileDocsByFileId,
  };
}
