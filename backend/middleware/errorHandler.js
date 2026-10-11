function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const isBodyTooLarge = error.type === "entity.too.large";
  const isInvalidJson = error instanceof SyntaxError && error.status === 400 && "body" in error;
  const status = isBodyTooLarge ? 413 : isInvalidJson ? 400 : 500;
  const message = isBodyTooLarge
    ? "Request body is too large. Please reduce the amount of submitted code."
    : isInvalidJson
      ? "Request body must be valid JSON."
      : "The server could not process this request. Please try again.";

  console.error(JSON.stringify({
    level: "error",
    event: "request_error",
    requestId: req.requestId,
    status,
    errorType: error.type || error.name,
  }));

  return res.status(status).json({
    success: false,
    message,
    requestId: req.requestId,
  });
}

module.exports = { errorHandler };
