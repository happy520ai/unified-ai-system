/**
 * Forge Multi-User — UserManager handles user CRUD, API-key authentication,
 * and key rotation for the Forge multi-user module.
 *
 * Usage:
 *   const um = new UserManager(db);
 *   const user = um.createUser({ username: 'alice', displayName: 'Alice', role: 'admin' });
 *   const authed = um.getUserByApiKey(user.apiKey);
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';

const ALLOWED_ROLES = new Set(['admin', 'developer', 'viewer']);
const HASH_PREFIX = 'sha256:';

export class UserManager {
  #db;

  /** @param {import('better-sqlite3').Database} db — an open better-sqlite3 instance */
  constructor(db) {
    this.#db = db;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Generate a forge-style API key: `fk-<uuid>` */
  #generateApiKey() {
    return `fk-${randomBytes(32).toString('base64url')}`;
  }

  #hashApiKey(apiKey) {
    return `${HASH_PREFIX}${createHash('sha256').update(String(apiKey)).digest('hex')}`;
  }

  // ── CRUD ───────────────────────────────────────────────────────────────

  /**
   * Create a new user with a generated API key.
   * @param {{ username: string, displayName?: string, role?: string }} opts
   * @returns {{ id: string, username: string, display_name: string|null, api_key: string, role: string, created_at: string, last_active: string|null }}
   */
  createUser({ username, displayName, role = 'developer' }) {
    const normalizedUsername = String(username ?? '').trim();
    if (!normalizedUsername) throw new Error('username is required');
    if (!ALLOWED_ROLES.has(role)) throw new Error(`Unsupported Forge role: ${role}`);
    const id = `u-${randomUUID().slice(0, 12)}`;
    const apiKey = this.#generateApiKey();
    const apiKeyHash = this.#hashApiKey(apiKey);

    this.#db.prepare(`
      INSERT INTO users (id, username, display_name, api_key, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, normalizedUsername, displayName ?? null, apiKeyHash, role);

    return { ...this.getUser(id), apiKey };
  }

  /**
   * Get a user by their ID.
   * @param {string} id
   * @returns {object|undefined}
   */
  getUser(id) {
    return sanitizeUserRow(this.#db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  }

  /**
   * Look up a user by username.
   * @param {string} username
   * @returns {object|undefined}
   */
  getUserByUsername(username) {
    return sanitizeUserRow(this.#db.prepare('SELECT * FROM users WHERE username = ?').get(username));
  }

  /**
   * Authenticate a user by API key.
   * @param {string} apiKey
   * @returns {object|undefined}
   */
  getUserByApiKey(apiKey) {
    const apiKeyHash = this.#hashApiKey(apiKey);
    let user = this.#db.prepare('SELECT * FROM users WHERE api_key = ?').get(apiKeyHash);
    if (!user) {
      // One-time migration for legacy databases that stored the raw key.
      user = this.#db.prepare('SELECT * FROM users WHERE api_key = ?').get(String(apiKey));
      if (user) {
        this.#db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(apiKeyHash, user.id);
        user = { ...user, api_key: apiKeyHash };
      }
    }
    return sanitizeUserRow(user);
  }

  /**
   * List all users.
   * @returns {object[]}
   */
  listUsers() {
    return this.#db.prepare('SELECT * FROM users ORDER BY created_at DESC').all().map(sanitizeUserRow);
  }

  /**
   * Update the last_active timestamp for a user to the current time.
   * @param {string} userId
   */
  updateLastActive(userId) {
    const now = new Date().toISOString();
    this.#db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run(now, userId);
  }

  /**
   * Delete a user. If the user has referenced rows (sessions, knowledge,
   * agent_assignments) the delete will fail due to foreign-key constraints.
   * @param {string} id
   * @returns {{ changes: number }}
   */
  deleteUser(id) {
    const info = this.#db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return { changes: info.changes };
  }

  /**
   * Rotate (regenerate) the API key for a given user.
   * @param {string} userId
   * @returns {string} the new API key
   */
  rotateApiKey(userId) {
    const newKey = this.#generateApiKey();
    this.#db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(this.#hashApiKey(newKey), userId);
    return newKey;
  }
}

function sanitizeUserRow(user) {
  if (!user) return undefined;
  const { api_key: _apiKeyHash, ...safe } = user;
  return safe;
}
