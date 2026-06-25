// =============================================================================
// realtimeCollaboration.js — 实时协作系统
// 多用户 Prompt 编辑、光标同步、版本冲突解决
// =============================================================================

import { randomUUID } from "node:crypto";

export function createRealtimeCollaboration(options = {}) {
  const sessions = new Map(); // sessionId -> { id, document, users, operations }
  const MAX_SESSIONS = 100;
  const MAX_USERS_PER_SESSION = 50;

  function createSession(documentId, initialContent = "") {
    if (sessions.size >= MAX_SESSIONS) throw new Error("Max sessions reached");
    const sessionId = randomUUID().slice(0, 8);
    const session = {
      id: sessionId,
      documentId,
      content: initialContent,
      users: new Map(),
      operations: [],
      version: 0,
      createdAt: Date.now(),
    };
    sessions.set(sessionId, session);
    return session;
  }

  function joinSession(sessionId, userId, userName) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    if (session.users.size >= MAX_USERS_PER_SESSION) throw new Error("Session full");

    const user = {
      userId,
      userName,
      cursor: { line: 0, column: 0 },
      color: generateUserColor(session.users.size),
      joinedAt: Date.now(),
      active: true,
    };
    session.users.set(userId, user);

    // 通知其他用户
    broadcast(sessionId, userId, { type: "user_joined", user: { userId, userName, color: user.color } });

    return { sessionId, content: session.content, version: session.version, users: Array.from(session.users.values()) };
  }

  function leaveSession(sessionId, userId) {
    const session = sessions.get(sessionId);
    if (!session) return;
    session.users.delete(userId);
    broadcast(sessionId, userId, { type: "user_left", userId });
    if (session.users.size === 0) sessions.delete(sessionId);
  }

  function applyOperation(sessionId, userId, operation) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    // OT 操作类型
    switch (operation.type) {
      case "insert":
        session.content = session.content.slice(0, operation.position) + operation.text + session.content.slice(operation.position);
        break;
      case "delete":
        session.content = session.content.slice(0, operation.position) + session.content.slice(operation.position + operation.length);
        break;
      case "replace":
        session.content = session.content.slice(0, operation.position) + operation.text + session.content.slice(operation.position + operation.length);
        break;
    }

    session.version++;
    const op = { ...operation, userId, version: session.version, timestamp: Date.now() };
    session.operations.push(op);
    if (session.operations.length > 1000) session.operations.shift();

    broadcast(sessionId, userId, { type: "operation", operation: op });
    return op;
  }

  function updateCursor(sessionId, userId, cursor) {
    const session = sessions.get(sessionId);
    const user = session?.users.get(userId);
    if (user) {
      user.cursor = cursor;
      broadcast(sessionId, userId, { type: "cursor_update", userId, cursor });
    }
  }

  function broadcast(sessionId, excludeUserId, message) {
    const session = sessions.get(sessionId);
    if (!session) return;
    for (const [uid, user] of session.users) {
      if (uid !== excludeUserId && user.onMessage) {
        try { user.onMessage(message); } catch (err) { console.error("[realtimeCollaboration]:", err?.message || err); }
      }
    }
  }

  function getSession(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return null;
    return {
      id: s.id,
      documentId: s.documentId,
      content: s.content,
      version: s.version,
      users: Array.from(s.users.values()),
      operations: s.operations.slice(-20),
    };
  }

  function listSessions() {
    return Array.from(sessions.values()).map((s) => ({
      id: s.id,
      documentId: s.documentId,
      users: s.users.size,
      version: s.version,
    }));
  }

  function generateUserColor(index) {
    const colors = ["#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6", "#bfef45", "#fabed4"];
    return colors[index % colors.length];
  }

  function getStats() {
    return {
      activeSessions: sessions.size,
      totalUsers: Array.from(sessions.values()).reduce((s, sess) => s + sess.users.size, 0),
      totalOperations: Array.from(sessions.values()).reduce((s, sess) => s + sess.operations.length, 0),
    };
  }

  return { createSession, joinSession, leaveSession, applyOperation, updateCursor, getSession, listSessions, getStats };
}
