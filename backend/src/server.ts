import { createBackendApp } from './app';
import { backendConfig } from './config';

const app = createBackendApp();
const PORT = backendConfig.port;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log('====================================================');
  console.log('🚀 AniLove Backend Service running successfully!');
  console.log(`📡 URL: http://${HOST}:${PORT}`);
  console.log(`🌐 Port: ${PORT} (from process.env.PORT)`);
  console.log(`⚙️  Node Environment: ${backendConfig.nodeEnv}`);
  console.log(`🛡️  Allowed Origins: ${backendConfig.corsOrigins.join(', ')}`);
  console.log('🔗 Health check: /api/health');
  console.log('====================================================');
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`\n[Backend] Received ${signal}. Closing HTTP server gracefully...`);
  server.close(() => {
    console.log('[Backend] HTTP server closed cleanly. Exiting.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[Backend] Forced termination after timeout.');
    process.exit(1);
  }, 8000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
