function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ success: false, message: "Please sign in to analyze code." });
  }
  req.user = { id: req.session.userId };
  return next();
}

module.exports = { requireAuth };
