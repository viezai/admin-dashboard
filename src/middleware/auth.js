/**
 * Admin Authentication Middleware
 * Validates Bearer token or x-admin-token against configured ADMIN_KEY
 */
export function requireAdminAuth(req, res, next) {
  const configuredKey = process.env.ADMIN_KEY || 'viezai_admin_2026';

  let token = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-admin-token']) {
    token = String(req.headers['x-admin-token']).trim();
  } else if (req.query && req.query.token) {
    token = String(req.query.token).trim();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Yêu cầu quyền quản trị: Thiếu token xác thực.'
    });
  }

  if (token !== configuredKey) {
    return res.status(401).json({
      success: false,
      error: 'Token quản trị không hợp lệ hoặc đã hết hạn.'
    });
  }

  // Auth passed
  req.admin = { role: 'admin' };
  next();
}