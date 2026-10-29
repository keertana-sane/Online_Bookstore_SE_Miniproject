const AppError = require('../utils/AppError');
const { logSecurityEvent } = require('../utils/securityEvents');

function createLoginRateLimiter({
  limit = 10,
  windowMs = 15 * 60 * 1000,
  now = Date.now,
  onLimit = logSecurityEvent
} = {}) {
  const attempts = new Map();

  return function loginRateLimit(req, res, next) {
    const currentTime = now();
    for (const [ip, entry] of attempts) {
      if (currentTime >= entry.resetAt) attempts.delete(ip);
    }

    const ip = req.ip || 'unknown';
    const entry = attempts.get(ip);
    if (!entry || currentTime >= entry.resetAt) {
      attempts.set(ip, { count: 1, resetAt: currentTime + windowMs });
      res.set('RateLimit-Limit', String(limit));
      res.set('RateLimit-Remaining', String(limit - 1));
      return next();
    }

    entry.count += 1;
    res.set('RateLimit-Limit', String(limit));
    res.set('RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
    res.set('RateLimit-Reset', String(Math.ceil((entry.resetAt - currentTime) / 1000)));

    if (entry.count > limit) {
      onLimit(req, 'login_rate_limited');
      return next(new AppError(429, 'RATE_LIMITED', 'Too many login attempts. Please try again later.'));
    }
    return next();
  };
}

module.exports = { createLoginRateLimiter };
