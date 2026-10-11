const { randomUUID } = require("node:crypto");

function requestLogger(req, res, next) {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();
  const path = req.path;

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(JSON.stringify({
      level: "info",
      event: "http_request",
      requestId,
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
    }));
  });

  next();
}

module.exports = { requestLogger };
