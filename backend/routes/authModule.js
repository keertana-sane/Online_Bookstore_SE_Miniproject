const { createAuthService } = require('../services/authService');
const { createAuthRouter } = require('./authRoutes');
const { createAuthenticateMiddleware } = require('../middleware/authenticate');
const { createLoginRateLimiter } = require('../middleware/loginRateLimit');
const { logSecurityEvent } = require('../utils/securityEvents');

function createAuthModule({
  jwtSecret = process.env.JWT_SECRET,
  userRepo = require('../repositories/userRepository'),
  expressImpl = require('express'),
  bcryptImpl,
  jwtImpl,
  securityLogger = logSecurityEvent,
  loginRateLimiter = createLoginRateLimiter({ onLimit: securityLogger })
} = {}) {
  const authenticate = createAuthenticateMiddleware({ jwtSecret, jwtImpl, securityLogger });
  const authService = createAuthService({ userRepo, jwtSecret, bcryptImpl, jwtImpl });
  const router = expressImpl.Router();
  router.use(createAuthRouter({ authService, expressImpl, loginRateLimiter, securityLogger }));
  return { router, authenticate };
}

module.exports = { createAuthModule, createAuthenticateMiddleware };
