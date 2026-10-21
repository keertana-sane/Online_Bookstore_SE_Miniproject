const AUTH_ERROR = {
  error: {
    code: 'UNAUTHORIZED',
    message: 'Login required'
  }
};

function createAuthenticateMiddleware({
  jwtSecret = process.env.JWT_SECRET,
  jwtImpl = require('jsonwebtoken')
} = {}) {
  if (typeof jwtSecret !== 'string' || jwtSecret.length === 0) {
    throw new Error('JWT_SECRET must be set before initializing authentication');
  }

  return function authenticate(req, res, next) {
    const authorization = req.get('authorization') || '';
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match) {
      return res.status(401).json(AUTH_ERROR);
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
        return res.status(401).json(AUTH_ERROR);
      }

      req.user = { id: claims.sub, role: claims.role };
      return next();
    } catch (err) {
      if (
        err instanceof jwtImpl.JsonWebTokenError ||
        err instanceof jwtImpl.TokenExpiredError
      ) {
        return res.status(401).json(AUTH_ERROR);
      }
      return next(err);
    }
  };
}

module.exports = { createAuthenticateMiddleware };
