function createRequireRoleMiddleware(requiredRole) {
  if (typeof requiredRole !== 'string' || requiredRole.length === 0) {
    throw new Error('A required role must be provided');
  }

  return function requireRole(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Login required' }
      });
    }
    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource' }
      });
    }
    return next();
  };
}

module.exports = { createRequireRoleMiddleware };
