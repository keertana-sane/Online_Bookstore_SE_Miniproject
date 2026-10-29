const { logSecurityEvent } = require('../utils/securityEvents');

function errorResponse(req, code, message) {
  const error = { code, message };
  if (req.requestId) error.requestId = req.requestId;
  return { error };
}

function createRequireRoleMiddleware(requiredRole, { securityLogger = logSecurityEvent } = {}) {
  if (typeof requiredRole !== 'string' || requiredRole.length === 0) {
    throw new Error('A required role must be provided');
  }

  return function requireRole(req, res, next) {
    if (!req.user) {
      securityLogger(req, 'unauthorized_access');
      return res.status(401).json(errorResponse(req, 'UNAUTHORIZED', 'Login required'));
    }
    if (req.user.role !== requiredRole) {
      securityLogger(req, 'unauthorized_access');
      return res.status(403).json(errorResponse(
        req,
        'FORBIDDEN',
        'You do not have permission to access this resource'
      ));
    }
    return next();
  };
}

module.exports = { createRequireRoleMiddleware };
