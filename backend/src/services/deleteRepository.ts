/**
 * Codebase Bible - Delete Repository Service
 * 
 * Deletes a repository and all its related data (files, code chunks, generated docs).
 * Thanks to onDelete: Cascade in schema.prisma, related records are automatically deleted.
 */

import { prisma } from '../db/prisma.js';

export interface DeleteRepositoryRequest {
  repositoryId: string;
}

export interface DeleteRepositoryResponse {
  success: true;
  repositoryId: string;
  repoName: string;
}

/**
 * Delete a repository by ID.
 * All related files, code chunks, and generated docs are automatically deleted
 * due to onDelete: Cascade in the Prisma schema.
 */
export async function deleteRepository(
  req: DeleteRepositoryRequest
): Promise<DeleteRepositoryResponse> {
  const { repositoryId } = req;

  // First, fetch the repository to get its name (for the response)
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { id: true, repoName: true },
  });

  if (!repository) {
    throw new Error(`Repository with ID ${repositoryId} not found`);
  }

  // Delete the repository (cascade will handle related records)
  await prisma.repository.delete({
    where: { id: repositoryId },
  });

  return {
    success: true,
    repositoryId: repository.id,
    repoName: repository.repoName,
  };
}

// Made with Bob