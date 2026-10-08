/**
 * Lightweight In-Memory Sliding Window Rate Limiter
 */
export function createRateLimiter({ windowMs = 60 * 1000, maxRequests = 10, message = 'Quá nhiều yêu cầu từ IP của bạn. Vui lòng thử lại sau.' } = {}) {
  const ipRequests = new Map();

  // Periodic cleanup every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipRequests.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
      if (validTimestamps.length === 0) {
        ipRequests.delete(ip);
      } else {
        ipRequests.set(ip, validTimestamps);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    const timestamps = ipRequests.get(ip) || [];
    const recentTimestamps = timestamps.filter(ts => now - ts < windowMs);

    if (recentTimestamps.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: message,
        retryAfterSeconds: Math.ceil((recentTimestamps[0] + windowMs - now) / 1000)
      });
    }

    recentTimestamps.push(now);
    ipRequests.set(ip, recentTimestamps);
    next();
  };
}