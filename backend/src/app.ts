import express, { Express, Request, Response, NextFunction } from 'express';
import { corsMiddleware } from './cors';
import { initInMemoryReels } from './services/driveReels';

import healthRoutes from './routes/health';
import streamingRoutes from './routes/streaming';
import reelsRoutes from './routes/reels';
import themesRoutes from './routes/themes';
import malRoutes from './routes/mal';
import userSyncRoutes from './routes/userSync';
import aiRoutes from './routes/ai';

export function createBackendApp(): Express {
  const app = express();

  // Initialize background data caches
  initInMemoryReels();

  // Apply Cross-Origin Resource Sharing (Web + Android APK + Localhost support)
  app.use(corsMiddleware);

  // Body parsers
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Root health check & API health check
  app.use('/', healthRoutes);
  app.use('/api', healthRoutes);

  // Core API route modules
  app.use('/api', streamingRoutes);
  app.use('/api', reelsRoutes);
  app.use('/api', themesRoutes);
  app.use('/api', malRoutes);
  app.use('/api', userSyncRoutes);
  app.use('/api', aiRoutes);

  // 404 handler for unmatched /api routes
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `API route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Backend Server Error]:', err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
      });
    }
  });

  return app;
}
