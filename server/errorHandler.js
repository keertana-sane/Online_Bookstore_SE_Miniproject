function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const error = err || {};
  const status =
    Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
      ? error.status
      : 500;
  if (status >= 500) {
    console.error("Request failed:", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      message: error.message
    });
  }

  const code =
    status < 500 && typeof error.code === "string"
      ? error.code
      : status === 413
        ? "PAYLOAD_TOO_LARGE"
        : status === 404
          ? "NOT_FOUND"
          : status === 400
            ? "BAD_REQUEST"
            : "INTERNAL_ERROR";
  const payload = {
    code,
    message: status < 500 ? error.message || "Request failed" : "Something went wrong"
  };
  if (Array.isArray(error.details)) {
    payload.details = error.details;
  }
  if (req.requestId) payload.requestId = req.requestId;

  return res.status(status).json({ error: payload });
}

module.exports = { errorHandler };
