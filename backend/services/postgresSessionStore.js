const { createHash } = require("node:crypto");
const session = require("express-session");
const pool = require("../config/db");

function hashSessionId(sessionId) {
  return createHash("sha256").update(sessionId).digest("hex");
}

class PostgresSessionStore extends session.Store {
  get(sessionId, callback) {
    pool.query(
      "SELECT session_data FROM app_sessions WHERE token_hash = $1 AND expires_at > now()",
      [hashSessionId(sessionId)],
    ).then(({ rows }) => callback(null, rows[0]?.session_data || null)).catch(callback);
  }

  set(sessionId, sessionData, callback = () => {}) {
    const expiresAt = sessionData.cookie?.expires || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    pool.query(
      `INSERT INTO app_sessions (token_hash, user_id, expires_at, session_data)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (token_hash) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           expires_at = EXCLUDED.expires_at,
           session_data = EXCLUDED.session_data`,
      [hashSessionId(sessionId), sessionData.userId, expiresAt, JSON.stringify(sessionData)],
    ).then(() => callback()).catch(callback);
  }

  destroy(sessionId, callback = () => {}) {
    pool.query("DELETE FROM app_sessions WHERE token_hash = $1", [hashSessionId(sessionId)])
      .then(() => callback()).catch(callback);
  }

  touch(sessionId, sessionData, callback = () => {}) {
    const expiresAt = sessionData.cookie?.expires || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    pool.query(
      "UPDATE app_sessions SET expires_at = $2 WHERE token_hash = $1",
      [hashSessionId(sessionId), expiresAt],
    ).then(() => callback()).catch(callback);
  }
}

module.exports = PostgresSessionStore;
