import { prisma } from '../db/prisma.js';

interface RepoSummary {
  id: string;
  githubUrl: string;
  repoName: string;
  status: string;
  docsStatus: string; // 'idle' if undefined on the row
  lastScannedAt: number | null;
  /** Total surviving files post-filter. */
  fileCount: number;
  /** True if the repo has at least one generated `repo_overview` row. */
  hasOverview: boolean;
  /** Distinct fileIds with at least one `file_deepdive` row. */
  documentedFileCount: number;
  /** Repo row's last-touched time. Drives recency sort in the UI. */
  updatedAt: number;
}

/**
 * Lists every repository known to the system with summary stats for the
 * frontend home/dashboard. Cheap aggregate queries, no per-row work in
 * the loop. Sorted newest-first by `updatedAt`.
 */
export async function listRepositories(): Promise<{ repositories: RepoSummary[] }> {
  // Pull every row from each table once using Prisma
  const [repos, allFiles, allDocs] = await Promise.all([
    prisma.repository.findMany({
      select: {
        id: true,
        githubUrl: true,
        repoName: true,
        status: true,
        docsStatus: true,
        lastScannedAt: true,
        updatedAt: true,
      },
    }),
    prisma.file.findMany({
      select: {
        repoId: true,
      },
    }),
    prisma.generatedDoc.findMany({
      select: {
        repoId: true,
        fileId: true,
        docType: true,
      },
    }),
  ]);

  // Group files by repoId.
  const filesByRepo = new Map<string, number>();
  for (const f of allFiles) {
    filesByRepo.set(f.repoId, (filesByRepo.get(f.repoId) ?? 0) + 1);
  }

  // Per-repo doc stats: at-least-one overview, distinct file_deepdive fileIds.
  const overviewByRepo = new Set<string>();
  const documentedFilesByRepo = new Map<string, Set<string>>();
  for (const d of allDocs) {
    if (d.docType === 'repo_overview') {
      overviewByRepo.add(d.repoId);
    } else if (d.docType === 'file_deepdive' && d.fileId) {
      let set = documentedFilesByRepo.get(d.repoId);
      if (!set) {
        set = new Set<string>();
        documentedFilesByRepo.set(d.repoId, set);
      }
      set.add(d.fileId);
    }
  }

  const summaries: RepoSummary[] = repos.map((r) => ({
    id: r.id,
    githubUrl: r.githubUrl,
    repoName: r.repoName,
    status: r.status,
    docsStatus: r.docsStatus ?? 'idle',
    lastScannedAt: r.lastScannedAt ? Number(r.lastScannedAt) : null,
    fileCount: filesByRepo.get(r.id) ?? 0,
    hasOverview: overviewByRepo.has(r.id),
    documentedFileCount: documentedFilesByRepo.get(r.id)?.size ?? 0,
    updatedAt: r.updatedAt.getTime(),
  }));

  // Newest-first.
  summaries.sort((a, b) => b.updatedAt - a.updatedAt);

  return { repositories: summaries };
}
