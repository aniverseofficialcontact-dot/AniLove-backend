import { Router } from 'express';
import { resolveTrackerUser, userSyncStore } from '../services/userSync';

const router = Router();

// GET user sync state
router.get('/user/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      res.status(401).json({ error: 'Tracker authorization token or username identifier is required' });
      return;
    }

    const viewer = await resolveTrackerUser(token);
    if (!viewer) {
      res.status(401).json({ error: 'Unable to resolve tracker identity' });
      return;
    }

    const stored = userSyncStore.get(viewer.id) || null;
    res.json({
      success: true,
      user: viewer,
      data: stored,
    });
  } catch (err: any) {
    console.error('User sync GET error:', err);
    res.status(500).json({ error: err.message || 'Failed to retrieve user sync data' });
  }
});

// POST user sync update
router.post('/user/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      res.status(401).json({ error: 'Tracker authorization token or username identifier is required' });
      return;
    }

    const viewer = await resolveTrackerUser(token);
    if (!viewer) {
      res.status(401).json({ error: 'Unable to resolve tracker identity' });
      return;
    }

    const { coins, characterCards, cardAwakenings, activeCompanion, watchHistory, dailyGameRecords } = req.body || {};
    const existing = userSyncStore.get(viewer.id) || {
      userId: viewer.id,
      userName: viewer.name,
      provider: viewer.provider,
      coins: 10,
      characterCards: [],
      cardAwakenings: {},
      activeCompanion: null,
      watchHistory: [],
      dailyGameRecords: {},
      lastSyncedAt: 0,
    };

    // Merge character cards (union by id)
    let mergedCards = existing.characterCards || [];
    if (Array.isArray(characterCards)) {
      const cardMap = new Map<string, any>();
      mergedCards.forEach((c: any) => {
        if (c && c.id) cardMap.set(c.id, c);
      });
      characterCards.forEach((c: any) => {
        if (c && c.id) {
          const current = cardMap.get(c.id);
          if (!current || (c.obtainedAt && c.obtainedAt > (current.obtainedAt || 0))) {
            cardMap.set(c.id, c);
          }
        }
      });
      mergedCards = Array.from(cardMap.values());
    }

    // Merge card awakenings
    const mergedAwakenings = { ...(existing.cardAwakenings || {}) };
    if (cardAwakenings && typeof cardAwakenings === 'object') {
      Object.entries(cardAwakenings).forEach(([cardId, lvl]) => {
        const numLvl = Number(lvl);
        mergedAwakenings[cardId] = Math.max(mergedAwakenings[cardId] || 1, numLvl);
      });
    }

    // Merge coins
    let updatedCoins = existing.coins || 10;
    if (typeof coins === 'number' && !isNaN(coins)) {
      updatedCoins = Math.max(0, coins);
    }

    // Merge watch history
    let mergedHistory = existing.watchHistory || [];
    if (Array.isArray(watchHistory)) {
      const histMap = new Map<string, any>();
      mergedHistory.forEach((h: any) => {
        if (h && h.animeId) histMap.set(`${h.animeId}-${h.episodeNumber || 1}`, h);
      });
      watchHistory.forEach((h: any) => {
        if (h && h.animeId) {
          const key = `${h.animeId}-${h.episodeNumber || 1}`;
          const cur = histMap.get(key);
          if (!cur || (h.lastWatchedAt && h.lastWatchedAt >= (cur.lastWatchedAt || 0))) {
            histMap.set(key, h);
          }
        }
      });
      mergedHistory = Array.from(histMap.values()).slice(0, 60);
    }

    const updatedRecord = {
      userId: viewer.id,
      userName: viewer.name,
      coins: updatedCoins,
      characterCards: mergedCards,
      cardAwakenings: mergedAwakenings,
      activeCompanion: activeCompanion !== undefined ? activeCompanion : existing.activeCompanion,
      watchHistory: mergedHistory,
      dailyGameRecords: dailyGameRecords || existing.dailyGameRecords || {},
      lastSyncedAt: Date.now(),
    };

    userSyncStore.set(viewer.id, updatedRecord);

    res.json({
      success: true,
      lastSyncedAt: updatedRecord.lastSyncedAt,
      data: updatedRecord,
    });
  } catch (err: any) {
    console.error('User sync POST error:', err);
    res.status(500).json({ error: err.message || 'Failed to sync user data' });
  }
});

export default router;
