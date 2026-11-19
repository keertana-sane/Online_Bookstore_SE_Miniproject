function logSecurityEvent(req, event) {
  console.warn(JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    ip: req.ip,
    method: req.method,
    path: req.path,
    userId: req.user?.id || null
  }));
}

module.exports = { logSecurityEvent };
