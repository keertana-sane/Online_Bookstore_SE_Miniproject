const { body, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');
const { INPUT_LIMITS } = require('../utils/inputLimits');
const { createLoginRateLimiter } = require('../middleware/loginRateLimit');
const { logSecurityEvent } = require('../utils/securityEvents');

const validateRegistration = [
  body('name')
    .isString().withMessage('name is required')
    .bail()
    .trim()
    .isLength({ min: 1, max: INPUT_LIMITS.name })
    .withMessage(`name must be 1 to ${INPUT_LIMITS.name} characters`)
    .bail()
    .matches(/^[^<>]*$/)
    .withMessage('name must not contain markup'),
  body('email')
    .isString().withMessage('email must be a valid email address')
    .bail()
    .trim()
    .isEmail().withMessage('email must be a valid email address')
    .bail()
    .isLength({ max: INPUT_LIMITS.email })
    .withMessage(`email must be at most ${INPUT_LIMITS.email} characters`)
    .bail()
    .customSanitizer((email) => email.toLowerCase()),
  body('password')
    .isString().withMessage('password must be a string')
    .bail()
    .isLength({ min: 8, max: INPUT_LIMITS.password })
    .withMessage(`password must be 8 to ${INPUT_LIMITS.password} characters`)
];

function registrationValidationResult(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map(({ path, msg }) => ({ field: path, message: msg }));
    return next(new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', details));
  }
  return next();
}

function createAuthRouter({
  authService,
  expressImpl = require('express'),
  loginRateLimiter = createLoginRateLimiter(),
  securityLogger = logSecurityEvent
}) {
  const router = expressImpl.Router();

  router.post('/auth/register', validateRegistration, registrationValidationResult, async (req, res, next) => {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/login', loginRateLimiter, async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      res.status(200).json(result);
    } catch (err) {
      if (err && err.code === 'INVALID_CREDENTIALS') {
        securityLogger(req, 'login_failed');
      }
      next(err);
    }
  });

  return router;
}

module.exports = { createAuthRouter, validateRegistration, registrationValidationResult };
