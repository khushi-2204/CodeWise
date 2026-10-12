const { timingSafeEqual } = require("node:crypto");

function allowedFrontendOrigins() {
  const origins = (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set(origins);
}

function csrfProtection(req, res, next) {
  const origin = req.get("origin");
  const expectedToken = req.session?.csrfToken;
  const suppliedToken = req.get("x-csrf-token");
  const originAllowed = origin && allowedFrontendOrigins().has(origin);

  if (!originAllowed || !expectedToken || !suppliedToken) {
    return res.status(403).json({ success: false, message: "This request could not be verified. Refresh the page and try again." });
  }

  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return res.status(403).json({ success: false, message: "This request could not be verified. Refresh the page and try again." });
  }

  return next();
}

module.exports = { allowedFrontendOrigins, csrfProtection };
