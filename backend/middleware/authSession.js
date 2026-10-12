const session = require("express-session");
const PostgresSessionStore = require("../services/postgresSessionStore");

const COOKIE_NAME = "codewise.sid";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function createAuthSessionMiddleware() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters");
  }

  const sameSite = process.env.SESSION_COOKIE_SAME_SITE || "lax";
  const secureCookie = process.env.NODE_ENV === "production" || sameSite.toLowerCase() === "none";

  return session({
    name: COOKIE_NAME,
    secret: process.env.SESSION_SECRET,
    store: new PostgresSessionStore(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: secureCookie,
      sameSite,
      maxAge: COOKIE_MAX_AGE_MS,
      path: "/",
    },
  });
}

module.exports = { COOKIE_MAX_AGE_MS, COOKIE_NAME, createAuthSessionMiddleware };
