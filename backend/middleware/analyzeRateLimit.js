function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createAnalyzeRateLimiter({ windowMs, maxRequests, now = Date.now }) {
  const clients = new Map();
  let requestCount = 0;

  return function analyzeRateLimit(req, res, next) {
    const currentTime = now();
    const clientId = req.ip || req.socket?.remoteAddress || "unknown";
    let bucket = clients.get(clientId);

    if (!bucket || currentTime >= bucket.resetAt) {
      if (!bucket && clients.size >= 10_000) {
        const oldestClientId = clients.keys().next().value;
        clients.delete(oldestClientId);
      }
      bucket = { count: 0, resetAt: currentTime + windowMs };
      clients.set(clientId, bucket);
    }

    bucket.count += 1;
    requestCount += 1;

    if (requestCount % 100 === 0) {
      for (const [id, clientBucket] of clients) {
        if (currentTime >= clientBucket.resetAt) clients.delete(id);
      }
    }

    const remaining = Math.max(0, maxRequests - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000));
    res.setHeader("RateLimit-Limit", String(maxRequests));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (bucket.count > maxRequests) {
      res.setHeader("Retry-After", String(resetSeconds));
      return res.status(429).json({
        success: false,
        message: "You have reached the analysis request limit. Please wait before trying again.",
      });
    }

    return next();
  };
}

const analyzeRateLimit = createAnalyzeRateLimiter({
  windowMs: positiveInteger(process.env.ANALYZE_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  maxRequests: positiveInteger(process.env.ANALYZE_RATE_LIMIT_MAX, 10),
});

module.exports = { analyzeRateLimit, createAnalyzeRateLimiter };
