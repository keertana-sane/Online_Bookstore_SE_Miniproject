function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status =
    Number.isInteger(err.status) && err.status >= 400 && err.status <= 599
      ? err.status
      : 500;
  if (status >= 500) {
    console.error("Request failed:", err);
  }

  const error = {
    code:
      status < 500 && typeof err.code === "string"
        ? err.code
        : status === 400
          ? "BAD_REQUEST"
          : "INTERNAL_ERROR",
    message: status < 500 ? err.message : "Something went wrong"
  };
  if (Array.isArray(err.details)) {
    error.details = err.details;
  }

  return res.status(status).json({ error });
}

module.exports = { errorHandler };
