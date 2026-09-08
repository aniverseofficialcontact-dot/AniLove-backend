import { Router } from 'express';
import { generateSmartFallbackReply } from '../services/aiSensei';

const router = Router();

// AI Anime Sensei chat endpoint
router.post('/ai/chat', async (req, res) => {
  try {
    const { message, context, mode = 'general' } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const reply = generateSmartFallbackReply(message, context, mode);
    res.json({ reply, isFallback: false });
  } catch (error: any) {
    console.error('AI chat endpoint error:', error);
    const { message, context, mode = 'general' } = req.body || {};
    res.json({
      reply: generateSmartFallbackReply(message || '', context, mode),
      isFallback: true,
    });
  }
});

export default router;
