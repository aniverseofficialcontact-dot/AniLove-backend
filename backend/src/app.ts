import express, { Express, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
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

  // Check if frontend build (dist/index.html) is available to serve
  const distDir = path.join(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');

  if (fs.existsSync(indexHtmlPath)) {
    // Serve static frontend assets
    app.use(express.static(distDir));

    // Wildcard fallback to index.html for SPA routes (excluding /api)
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(indexHtmlPath);
    });
  } else {
    // Backend-only mode: provide a clean visual status page at root
    app.get('/', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AniLove Backend API Service</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0b0f19;
      color: #f1f5f9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .card {
      background: #151d2f;
      border: 1px solid #24324f;
      border-radius: 16px;
      padding: 32px 28px;
      max-width: 580px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #10b981;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
    }
    .badge::before {
      content: '';
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
    }
    h1 {
      margin: 16px 0 8px;
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
    }
    p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.5;
      margin: 0 0 20px;
    }
    .routes-box {
      background: #0d1322;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 24px;
      border: 1px solid #1e293b;
    }
    .route-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 14px;
    }
    .route-item:last-child { border-bottom: none; }
    .method {
      background: #3b82f6;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      margin-right: 8px;
    }
    a {
      color: #60a5fa;
      text-decoration: none;
      word-break: break-all;
    }
    a:hover { text-decoration: underline; }
    .footer-note {
      font-size: 13px;
      color: #64748b;
      border-top: 1px solid #1e293b;
      padding-top: 16px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Operational • Active</div>
    <h1>AniLove Backend Service</h1>
    <p>The backend API engine is live on Render, powering the AniLove web application and Android APK.</p>
    
    <div class="routes-box">
      <div class="route-item">
        <span><span class="method">GET</span><a href="/api/health" target="_blank">/api/health</a></span>
        <span style="color:#10b981; font-size:12px;">Health Check</span>
      </div>
      <div class="route-item">
        <span><span class="method">GET</span><a href="/api/reels?limit=5" target="_blank">/api/reels</a></span>
        <span style="color:#94a3b8; font-size:12px;">Anime Reels API</span>
      </div>
      <div class="route-item">
        <span><span class="method">GET</span><a href="/api/anikoto/search?keyword=naruto" target="_blank">/api/anikoto/search</a></span>
        <span style="color:#94a3b8; font-size:12px;">Streaming Search</span>
      </div>
    </div>

    <div class="footer-note">
      💡 <strong>Note:</strong> This URL is your standalone backend API. If you also want to host the full frontend UI directly on this URL, set your Render Build Command to <code>npm install && npm run build</code> and Start Command to <code>npm start</code>.
    </div>
  </div>
</body>
</html>`);
    });
  }

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
