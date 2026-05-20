### 1. File Purpose
This file is the main entry point for the backend API server. It initializes an Express.js application, configures middleware, defines routes, sets up error handling, and manages server lifecycle (startup and graceful shutdown). It serves as the HTTP interface for the repository analysis and documentation generation system, connecting frontend requests to backend services and the database.

### 2. Architecture and Design Patterns
This file implements a **layered monolithic architecture** as described in the context, specifically the backend service layer. It uses the **Express.js framework** following a **middleware and routing pattern**. The server acts as a facade, delegating business logic to the `apiRouter` (which in turn calls services like `ingestRepository.ts`). It integrates with the database via Prisma (`prisma.ts`) and handles cross-cutting concerns like CORS, body parsing, and logging. The architecture is event-driven in the broader system, but this file itself is synchronous and request-driven.

### 3. Public Interface
This file does not export any functions, classes, or types. It is a self-contained script that starts the server. The only external interaction is through the HTTP endpoints it exposes.

### 4. Internal Logic Walkthrough
The file follows a sequential initialization and configuration process:

1.  **Environment and App Setup**: It loads environment variables using `dotenv`, creates an Express app, and defines constants for the port and frontend URL.
    ```typescript
    dotenv.config();

    const app = express();
    const PORT = process.env.PORT || 3000;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    ```

2.  **Middleware Configuration**: It applies middleware in a specific order. CORS is configured to allow requests from the frontend, body parsing is set with a high limit for embedding vectors, and a development-only request logger is added.
    ```typescript
    app.use(
      cors({
        origin: FRONTEND_URL,
        credentials: true,
      })
    );

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    if (process.env.NODE_ENV === 'development') {
      app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
      });
    }
    ```

3.  **Route Definition**: It defines a health check endpoint directly on the app, mounts the main API router at `/api`, and adds a 404 handler for unmatched routes.
    ```typescript
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
      });
    });

    app.use('/api', apiRouter);

    app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });
    ```

4.  **Error Handling**: A global error handler is registered to catch all errors, log them, and return a 500 response. It conditionally includes error details (message and stack trace) only in development mode to avoid leaking sensitive information in production.
    ```typescript
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Error:', err);

      const isDevelopment = process.env.NODE_ENV === 'development';

      res.status(500).json({
        error: 'Internal Server Error',
        message: isDevelopment ? err.message : 'An unexpected error occurred',
        ...(isDevelopment && { stack: err.stack }),
      });
    });
    ```

5.  **Server Startup and Lifecycle**: The `startServer` function is asynchronous. It first tests the database connection using Prisma, then starts the HTTP server. It also sets up graceful shutdown handlers for `SIGINT` and `SIGTERM` signals, which disconnect from the database before exiting.
    ```typescript
    async function startServer() {
      try {
        await prisma.$connect();
        console.log('✓ Database connected');

        app.listen(PORT, () => {
          // ... console.log startup banner ...
        });
      } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
      }
    }

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

    startServer();
    ```

### 5. Dependencies and Integrations
-   **`express`**: Provides the core HTTP server and routing framework.
-   **`cors`**: Handles Cross-Origin Resource Sharing, configured to allow the frontend URL.
-   **`dotenv`**: Loads environment variables from a `.env` file.
-   **`./routes/api.js`**: Internal import. The `apiRouter` is mounted at `/api`, handling all API endpoint logic (delegated to services).
-   **`./db/prisma.js`**: Internal import. Provides the Prisma client for database connectivity. Used to test the connection on startup and disconnect on shutdown.

### 6. Edge Cases and Error Handling
-   **Database Connection Failure**: If `prisma.$connect()` fails during startup, the error is caught, logged, and the process exits with code 1.
-   **Missing Environment Variables**: Defaults are provided for `PORT` (3000) and `FRONTEND_URL` (`http://localhost:5173`).
-   **Production Error Leaks**: The global error handler checks `process.env.NODE_ENV` and only includes the error message and stack trace in development responses.
-   **Graceful Shutdown**: The server handles `SIGINT` (Ctrl+C) and `SIGTERM` signals to ensure the database connection is closed before the process terminates.
-   **404 Handling**: A final middleware catches all unmatched routes and returns a JSON 404 error.

### 7. Observations
-   **Code Smell**: The comment `// Made with Bob` at the end is non-standard and may be a placeholder or artifact.
-   **Configuration**: The server relies on environment variables for configuration, which is a good practice. The `FRONTEND_URL` is used for CORS, indicating a strict separation between backend and frontend.
-   **Logging**: Request logging is only enabled in development mode, which is appropriate for production performance.
-   **No Observations**: The code is clean, follows Express.js best practices, and integrates well with the described architecture. No significant architectural concerns are visible.