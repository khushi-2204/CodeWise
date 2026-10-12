const { randomBytes } = require("node:crypto");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { COOKIE_MAX_AGE_MS } = require("../middleware/authSession");

const BCRYPT_COST = 12;

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function validateCredentials({ name, email, password }, signingUp) {
  if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Enter a valid email address.";
  }
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") < 12 || Buffer.byteLength(password, "utf8") > 72) {
    return "Password must be between 12 and 72 bytes.";
  }
  if (signingUp && (typeof name !== "string" || !name.trim() || name.trim().length > 80)) {
    return "Name must be between 1 and 80 characters.";
  }
  return null;
}

function startAuthenticatedSession(req, userId, res, callback) {
  req.session.regenerate((regenerateError) => {
    if (regenerateError) return callback(regenerateError);
    req.session.userId = userId;
    req.session.csrfToken = randomBytes(32).toString("hex");
    req.session.cookie.maxAge = COOKIE_MAX_AGE_MS;
    req.session.save((saveError) => {
      if (saveError) return callback(saveError);
      return callback(null, req.session.csrfToken);
    });
  });
}

async function signup(req, res, next) {
  const { name, email, password } = req.body || {};
  const validationError = validateCredentials({ name, email, password }, true);
  if (validationError) return res.status(400).json({ success: false, message: validationError });

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const { rows } = await pool.query(
      `INSERT INTO app_users (name, email, password_hash, email_verified, updated_at)
       VALUES ($1, $2, $3, false, now())
       RETURNING id, name, email`,
      [name.trim(), normalizedEmail, passwordHash],
    );

    startAuthenticatedSession(req, rows[0].id, res, (error, csrfToken) => {
      if (error) return next(error);
      return res.status(201).json({ success: true, user: publicUser(rows[0]), csrfToken });
    });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ success: false, message: "An account with this email already exists." });
    return next(error);
  }
}

async function login(req, res, next) {
  const { email, password } = req.body || {};
  const validationError = validateCredentials({ email, password }, false);
  if (validationError) return res.status(400).json({ success: false, message: validationError });

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const { rows } = await pool.query(
      "SELECT id, name, email, password_hash FROM app_users WHERE lower(email) = $1 LIMIT 1",
      [normalizedEmail],
    );
    const user = rows[0];
    const passwordMatches = user?.password_hash ? await bcrypt.compare(password, user.password_hash) : false;
    if (!passwordMatches) return res.status(401).json({ success: false, message: "Email or password is incorrect." });

    startAuthenticatedSession(req, user.id, res, (error, csrfToken) => {
      if (error) return next(error);
      return res.status(200).json({ success: true, user: publicUser(user), csrfToken });
    });
  } catch (error) {
    return next(error);
  }
}

function getCsrfToken(req, res, next) {
  if (req.session.csrfToken) return res.status(200).json({ csrfToken: req.session.csrfToken });
  req.session.csrfToken = randomBytes(32).toString("hex");
  req.session.save((error) => {
    if (error) return next(error);
    return res.status(200).json({ csrfToken: req.session.csrfToken });
  });
}

async function getCurrentUser(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ success: false, message: "You are not signed in." });
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email FROM app_users WHERE id = $1",
      [req.session.userId],
    );
    if (!rows[0]) return req.session.destroy(() => res.status(401).json({ success: false, message: "You are not signed in." }));
    return res.status(200).json({ success: true, user: publicUser(rows[0]) });
  } catch (error) {
    return next(error);
  }
}

function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("codewise.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || (process.env.SESSION_COOKIE_SAME_SITE || "lax").toLowerCase() === "none",
      sameSite: process.env.SESSION_COOKIE_SAME_SITE || "lax",
      path: "/",
    });
    return res.status(200).json({ success: true, message: "You have been signed out." });
  });
}

module.exports = { getCsrfToken, getCurrentUser, login, logout, signup, validateCredentials };
