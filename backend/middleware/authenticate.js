const { logSecurityEvent } = require('../utils/securityEvents');

function unauthorized(req, res) {
  const error = { code: 'UNAUTHORIZED', message: 'Login required' };
  if (req.requestId) error.requestId = req.requestId;
  return res.status(401).json({ error });
}

function createAuthenticateMiddleware({
  jwtSecret = process.env.JWT_SECRET,
  jwtImpl = require('jsonwebtoken'),
  securityLogger = logSecurityEvent
} = {}) {
  if (typeof jwtSecret !== 'string' || jwtSecret.length === 0) {
    throw new Error('JWT_SECRET must be set before initializing authentication');
  }

  return function authenticate(req, res, next) {
    const authorization = req.get('authorization') || '';
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match) {
      securityLogger(req, 'unauthorized_access');
      return unauthorized(req, res);
    }

    try {
      const claims = jwtImpl.verify(match[1], jwtSecret, { algorithms: ['HS256'] });
      if (
        typeof claims !== 'object' ||
        claims === null ||
        typeof claims.sub !== 'string' ||
        !claims.sub ||
        !['CUSTOMER', 'ADMIN_STAFF'].includes(claims.role)
      ) {
        securityLogger(req, 'unauthorized_access');
        return unauthorized(req, res);
      }

      req.user = { id: claims.sub, role: claims.role };
      return next();
    } catch (err) {
      if (
        err instanceof jwtImpl.JsonWebTokenError ||
        err instanceof jwtImpl.TokenExpiredError
      ) {
        securityLogger(req, 'unauthorized_access');
        return unauthorized(req, res);
      }
      return next(err);
    }
  };
}

module.exports = { createAuthenticateMiddleware };
