const express = require('express');

/**
 * Minimal Express app for HTTP-level tests. The real app (scaffold, BK-01) provides
 * the JWT middleware (BK-07) and the central error handler (BK-23); these stand-ins
 * mimic their contract so the routes can be tested on their own:
 *  - authenticate: reads "Authorization: Bearer <customerId>" and sets req.user.id
 *  - error handler: converts AppError into the SAD 4.4 envelope
 */
function fakeAuthenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Login required' } });
  }
  req.user = { id: match[1], role: 'CUSTOMER' };
  return next();
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err && err.status) {
    return res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  return res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}

function createTestApp(buildRouters) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', buildRouters({ authenticate: fakeAuthenticate }));
  app.use(errorHandler);
  return app;
}

module.exports = { createTestApp, fakeAuthenticate };
