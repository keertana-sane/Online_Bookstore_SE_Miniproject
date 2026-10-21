const { createAuthService } = require('../services/authService');
const { createAuthRouter } = require('./authRoutes');
const { createAuthenticateMiddleware } = require('../middleware/authenticate');

function createAuthModule({
  jwtSecret = process.env.JWT_SECRET,
  userRepo = require('../repositories/userRepository'),
  expressImpl = require('express'),
  bcryptImpl,
  jwtImpl
} = {}) {
  const authenticate = createAuthenticateMiddleware({ jwtSecret, jwtImpl });
  const authService = createAuthService({ userRepo, jwtSecret, bcryptImpl, jwtImpl });
  const router = expressImpl.Router();
  router.use(createAuthRouter({ authService, expressImpl }));
  return { router, authenticate };
}

module.exports = { createAuthModule, createAuthenticateMiddleware };
