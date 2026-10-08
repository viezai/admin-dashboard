import express from 'express';
import { getStats } from '../db.js';
import { requireAdminAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/stats
 * Protected summary statistics
 */
router.get('/', requireAdminAuth, (req, res) => {
  try {
    const stats = getStats();
    const processed = (stats.contacting || 0) + (stats.completed || 0) + (stats.archived || 0);
    const completionRate = stats.total > 0 ? Math.round((processed / stats.total) * 100) : 0;

    return res.json({
      success: true,
      data: {
        ...stats,
        completionRate
      }
    });
  } catch (err) {
    console.error('[API Stats] Error:', err);
    return res.status(500).json({ success: false, error: 'Lỗi khi tính toán số liệu thống kê.' });
  }
});

export default router;