/**
 * Forge Multi-User — UserManager handles user CRUD, API-key authentication,
 * and key rotation for the Forge multi-user module.
 *
 * Usage:
 *   const um = new UserManager(db);
 *   const user = um.createUser({ username: 'alice', displayName: 'Alice', role: 'admin' });
 *   const authed = um.getUserByApiKey(user.apiKey);
 */

import { randomUUID } from 'node:crypto';

export class UserManager {
  #db;

  /** @param {import('better-sqlite3').Database} db — an open better-sqlite3 instance */
  constructor(db) {
    this.#db = db;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Generate a forge-style API key: `fk-<uuid>` */
  #generateApiKey() {
    return `fk-${randomUUID()}`;
  }

  // ── CRUD ───────────────────────────────────────────────────────────────

  /**
   * Create a new user with a generated API key.
   * @param {{ username: string, displayName?: string, role?: string }} opts
   * @returns {{ id: string, username: string, display_name: string|null, api_key: string, role: string, created_at: string, last_active: string|null }}
   */
  createUser({ username, displayName, role = 'developer' }) {
    const id = `u-${randomUUID().slice(0, 12)}`;
    const apiKey = this.#generateApiKey();

    this.#db.prepare(`
      INSERT INTO users (id, username, display_name, api_key, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, username, displayName ?? null, apiKey, role);

    return this.getUser(id);
  }

  /**
   * Get a user by their ID.
   * @param {string} id
   * @returns {object|undefined}
   */
  getUser(id) {
    return this.#db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  /**
   * Look up a user by username.
   * @param {string} username
   * @returns {object|undefined}
   */
  getUserByUsername(username) {
    return this.#db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  /**
   * Authenticate a user by API key.
   * @param {string} apiKey
   * @returns {object|undefined}
   */
  getUserByApiKey(apiKey) {
    return this.#db.prepare('SELECT * FROM users WHERE api_key = ?').get(apiKey);
  }

  /**
   * List all users.
   * @returns {object[]}
   */
  listUsers() {
    return this.#db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
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
    this.#db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(newKey, userId);
    return newKey;
  }
}
