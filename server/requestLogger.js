const { randomUUID } = require('crypto');

function requestLogger(req, res, next) {
  const startedAt = Date.now();
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  res.on('finish', () => {
    console.info(JSON.stringify({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt
    }));
  });
  return next();
}

module.exports = { requestLogger };
