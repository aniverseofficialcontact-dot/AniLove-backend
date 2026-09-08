import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'anilove-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    platform: 'render/node',
  });
});

export default router;
