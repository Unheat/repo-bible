/**
 * Codebase Bible - Express Server
 * 
 * Main entry point for the backend API server.
 * Replaces the proprietary @mindstudio-ai/agent platform with standard Express.js
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRouter } from './routes/api.js';
import { prisma } from './db/prisma.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS - Allow requests from frontend
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '50mb' })); // Large limit for embedding vectors
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API routes
app.use('/api', apiRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'An unexpected error occurred',
    ...(isDevelopment && { stack: err.stack }),
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✓ Database connected');

    // Start listening
    app.listen(PORT, () => {
      console.log('');
      console.log('========================================');
      console.log('  Codebase Bible API Server');
      console.log('========================================');
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Server:      http://localhost:${PORT}`);
      console.log(`Health:      http://localhost:${PORT}/health`);
      console.log(`API:         http://localhost:${PORT}/api`);
      console.log(`Frontend:    ${FRONTEND_URL}`);
      console.log('========================================');
      console.log('');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
startServer();

// Made with Bob
