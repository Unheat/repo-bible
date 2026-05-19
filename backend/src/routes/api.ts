/**
 * Codebase Bible - API Routes
 * 
 * REST API endpoints that wrap the existing service layer.
 * Replaces the proprietary @mindstudio-ai/interface RPC system.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';

// Import services (these will be updated to use Prisma in the next step)
import { ingestRepository } from '../services/ingestRepository.js';
import { generateBible } from '../services/generateBible.js';
import { listRepositories } from '../services/listRepositories.js';
import { getRepositoryDetail } from '../services/getRepositoryDetail.js';
import { openDocumentationPR } from '../services/openDocumentationPR.js';
import { deleteRepository } from '../services/deleteRepository.js';

export const apiRouter = Router();

// ============================================================================
// REPOSITORY ENDPOINTS
// ============================================================================

/**
 * POST /api/repositories/ingest
 * Ingest a GitHub repository
 * 
 * Body: { githubUrl: string }
 * Returns: { repositoryId, repoName, defaultBranch, status: 'processing' }
 */
apiRouter.post('/repositories/ingest', async (req: Request, res: Response) => {
  try {
    const { githubUrl } = req.body;

    if (!githubUrl || typeof githubUrl !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'githubUrl is required and must be a string',
      });
    }

    const result = await ingestRepository({ githubUrl });
    return res.json(result);
  } catch (error: any) {
    console.error('Error ingesting repository:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to ingest repository',
    });
  }
});

/**
 * GET /api/repositories
 * List all repositories
 * 
 * Returns: { repositories: Repository[] }
 */
apiRouter.get('/repositories', async (_req: Request, res: Response) => {
  try {
    const result = await listRepositories();
    return res.json(result);
  } catch (error: any) {
    console.error('Error listing repositories:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to list repositories',
    });
  }
});

/**
 * GET /api/repositories/:id
 * Get repository details including files and documentation
 * 
 * Params: { id: string }
 * Returns: { repository, files, documentation }
 */
apiRouter.get('/repositories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Repository ID is required',
      });
    }

    const result = await getRepositoryDetail({ repositoryId: id as string });
    return res.json(result);
  } catch (error: any) {
    console.error('Error getting repository detail:', error);
    
    // Handle not found case
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to get repository details',
    });
  }
});

/**
 * DELETE /api/repositories/:id
 * Delete a repository and all its related data
 *
 * Params: { id: string }
 * Returns: { success: true, repositoryId: string, repoName: string }
 */
apiRouter.delete('/repositories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Repository ID is required',
      });
    }

    const result = await deleteRepository({ repositoryId: id as string });
    return res.json(result);
  } catch (error: any) {
    console.error('Error deleting repository:', error);
    
    // Handle not found case
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to delete repository',
    });
  }
});

/**
 * PUT /api/repositories/:id/docs/:docId
 * Update documentation content
 *
 * Params: { id: string, docId: string }
 * Body: { content: string }
 * Returns: { success: true, document: GeneratedDoc }
 */
apiRouter.put('/repositories/:id/docs/:docId', async (req: Request, res: Response) => {
  try {
    const { id, docId } = req.params;
    const { content } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Repository ID is required',
      });
    }

    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Document ID is required',
      });
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Content is required and must be a string',
      });
    }

    // Import prisma client
    const { prisma } = await import('../db/prisma.js');

    // Verify the document exists and belongs to this repository
    const existingDoc = await prisma.generatedDoc.findUnique({
      where: { id: docId },
    });

    if (!existingDoc) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Document not found',
      });
    }

    if (existingDoc.repoId !== id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Document does not belong to this repository',
      });
    }

    // Update the document
    const updatedDoc = await prisma.generatedDoc.update({
      where: { id: docId },
      data: {
        markdownContent: content,
        updatedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      document: updatedDoc,
    });
  } catch (error: any) {
    console.error('Error updating documentation:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to update documentation',
    });
  }
});

// ============================================================================
// DOCUMENTATION GENERATION ENDPOINTS
// ============================================================================

/**
 * POST /api/repositories/:id/generate
 * Generate AI documentation for a repository
 * 
 * Params: { id: string }
 * Returns: { status: 'generating', message: string }
 */
apiRouter.post('/repositories/:id/generate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Repository ID is required',
      });
    }

    const result = await generateBible({ repositoryId: id as string });
    return res.json(result);
  } catch (error: any) {
    console.error('Error generating documentation:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to generate documentation',
    });
  }
});

/**
 * POST /api/repositories/:id/pr
 * Open a pull request with generated documentation
 * 
 * Params: { id: string }
 * Body: { branchName?: string }
 * Returns: { prUrl: string, branchName: string }
 */
apiRouter.post('/repositories/:id/pr', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Repository ID is required',
      });
    }

    const result = await openDocumentationPR({
      repositoryId: id as string,
    });
    return res.json(result);
  } catch (error: any) {
    console.error('Error opening PR:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to open pull request',
    });
  }
});

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

/**
 * GET /api/status
 * Get API status and configuration
 */
apiRouter.get('/status', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    features: {
      githubIntegration: !!process.env.GITHUB_TOKEN,
      openaiEmbeddings: !!process.env.OPENAI_API_KEY,
      openrouterLLM: !!process.env.OPENROUTER_API_KEY,
    },
  });
});

// Made with Bob
