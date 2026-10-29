function logSecurityEvent(req, event) {
  console.warn(JSON.stringify({
    event,
    requestId: req.requestId,
    ip: req.ip,
    method: req.method,
    path: req.path
  }));
}

module.exports = { logSecurityEvent };
