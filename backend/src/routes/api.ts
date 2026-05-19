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
    res.json(result);
  } catch (error: any) {
    console.error('Error ingesting repository:', error);
    res.status(500).json({
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
apiRouter.get('/repositories', async (req: Request, res: Response) => {
  try {
    const result = await listRepositories();
    res.json(result);
  } catch (error: any) {
    console.error('Error listing repositories:', error);
    res.status(500).json({
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
    res.json(result);
  } catch (error: any) {
    console.error('Error getting repository detail:', error);
    
    // Handle not found case
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to get repository details',
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
    res.json(result);
  } catch (error: any) {
    console.error('Error generating documentation:', error);
    res.status(500).json({
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
    res.json(result);
  } catch (error: any) {
    console.error('Error opening PR:', error);
    res.status(500).json({
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
apiRouter.get('/status', (req: Request, res: Response) => {
  res.json({
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
