function createAuthRateLimiter({ windowMs = 15 * 60 * 1000, maxRequests = 20, now = Date.now } = {}) {
  const clients = new Map();
  let requestCount = 0;
  return function authRateLimit(req, res, next) {
    const clientId = req.ip || req.socket?.remoteAddress || "unknown";
    const currentTime = now();
    let bucket = clients.get(clientId);
    if (!bucket || currentTime >= bucket.resetAt) {
      if (!bucket && clients.size >= 10_000) clients.delete(clients.keys().next().value);
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
    if (bucket.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ success: false, message: "Too many sign-in attempts. Please wait and try again." });
    }
    return next();
  };
}

const authRateLimit = createAuthRateLimiter();

module.exports = { authRateLimit, createAuthRateLimiter };
