import express from 'express';
import { requireAdminAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Simple Secret Key / Password Authentication
 */
router.post('/login', (req, res) => {
  const { password, key, token } = req.body || {};
  const input = String(password || key || token || '').trim();
  const configuredKey = (process.env.ADMIN_KEY || 'viezai_admin_2026').trim();

  if (!input) {
    return res.status(400).json({
      success: false,
      error: 'Vui lòng nhập mật khẩu hoặc mã khóa quản trị.'
    });
  }

  if (input !== configuredKey) {
    return res.status(401).json({
      success: false,
      error: 'Mật khẩu quản trị không chính xác.'
    });
  }

  return res.json({
    success: true,
    message: 'Đăng nhập thành công.',
    token: configuredKey,
    user: {
      role: 'admin',
      name: 'ViezAI Lead Administrator'
    }
  });
});

/**
 * GET /api/auth/verify
 * Check whether stored token is still valid
 */
router.get('/verify', requireAdminAuth, (req, res) => {
  return res.json({
    success: true,
    valid: true,
    user: {
      role: 'admin',
      name: 'ViezAI Lead Administrator'
    }
  });
});

export default router;