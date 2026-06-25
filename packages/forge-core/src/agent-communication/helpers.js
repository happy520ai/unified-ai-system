/**
 * Helper functions and constants for AgentCommunication module.
 * Extracted to keep index.js under 500 lines.
 */

// ── Enumerations ──────────────────────────────────────────────────────────────

/**
 * Types of findings that can be posted to the blackboard.
 * @readonly
 * @enum {string}
 */
export const FindingType = Object.freeze({
  DISCOVERY: 'discovery',
  CONSTRAINT: 'constraint',
  PATTERN: 'pattern',
  RISK: 'risk',
  DECISION: 'decision',
});

/**
 * Types of direct messages that can be sent between agents.
 * @readonly
 * @enum {string}
 */
export const MessageType = Object.freeze({
  REQUEST: 'request',
  RESPONSE: 'response',
  NOTIFICATION: 'notification',
  QUERY: 'query',
});

/**
 * Agent status values.
 * @readonly
 * @enum {string}
 */
export const AgentStatus = Object.freeze({
  IDLE: 'idle',
  WORKING: 'working',
  DONE: 'done',
});

/** All valid finding types as an array. */
export const ALL_FINDING_TYPES = Object.values(FindingType);

/** All valid message types as an array. */
export const ALL_MESSAGE_TYPES = Object.values(MessageType);

// ── Helper: unique id generator ───────────────────────────────────────────────

/**
 * Generate a short unique identifier.
 * @param {string} [prefix='id'] — optional prefix
 * @returns {string}
 */
export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Pure utility functions ────────────────────────────────────────────────────

/**
 * Tokenize a query string into lowercase word tokens.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .split(/[\s,;|]+/)
    .filter((t) => t.length > 0);
}

/**
 * Score the relevance of a finding against query tokens.
 *
 * Scoring components:
 *   - tag overlap:     0.4 weight (max contribution when all query tokens match tags)
 *   - content keyword: 0.4 weight (fraction of query tokens found in content)
 *   - recency:         0.2 weight (exponential decay over 10 minutes)
 *
 * @param {string[]} queryTokens — tokenized query
 * @param {object} finding — the finding to score (with tags, content, confidence)
 * @param {number} timestamp — when the finding was posted
 * @returns {number} relevance score between 0 and 1
 */
export function scoreRelevance(queryTokens, finding, timestamp) {
  if (queryTokens.length === 0) {
    // No query — score based purely on recency and confidence
    const age = Date.now() - timestamp;
    const recencyScore = Math.exp(-age / 600_000);
    return recencyScore * 0.5 + finding.confidence * 0.5;
  }

  // Tag overlap score
  const lowerTags = finding.tags.map((t) => t.toLowerCase());
  const tagHits = queryTokens.filter((t) => lowerTags.some((tag) => tag.includes(t) || t.includes(tag)));
  const tagScore = tagHits.length / queryTokens.length;

  // Content keyword score
  const lowerContent = finding.content.toLowerCase();
  const contentHits = queryTokens.filter((t) => lowerContent.includes(t));
  const contentScore = contentHits.length / queryTokens.length;

  // Recency score (exponential decay, half-life ~10 minutes)
  const age = Date.now() - timestamp;
  const recencyScore = Math.exp(-age / 600_000);

  // Weighted combination
  return tagScore * 0.4 + contentScore * 0.4 + recencyScore * 0.2;
}

/**
 * Evict the oldest blackboard entries when over capacity.
 * @param {Map<string, object>} blackboard — the blackboard map
 * @param {number} maxBoardEntries — maximum entries allowed
 */
export function evictBlackboard(blackboard, maxBoardEntries) {
  if (blackboard.size <= maxBoardEntries) return;

  // Sort entries by timestamp and remove oldest
  const sorted = [...blackboard.entries()]
    .sort((a, b) => a[1].timestamp - b[1].timestamp);

  const toRemove = sorted.slice(0, sorted.length - maxBoardEntries);
  for (const [key] of toRemove) {
    blackboard.delete(key);
  }
}

/**
 * Expire messages older than retentionMs from an agent's inbox.
 * @param {Array<object>} inbox — the message inbox array
 * @param {number} retentionMs — message retention time in milliseconds
 */
export function expireMessages(inbox, retentionMs) {
  if (!inbox) return;

  const cutoff = Date.now() - retentionMs;
  while (inbox.length > 0 && inbox[0].timestamp < cutoff) {
    inbox.shift();
  }
}

/**
 * Record an activity log entry with automatic size management.
 * @param {Array<{ timestamp: number, agentId: string, action: string }>} activityLog
 * @param {string} agentId
 * @param {string} action
 * @param {number} [maxSize=500] — maximum log entries
 */
export function logActivity(activityLog, agentId, action, maxSize = 500) {
  activityLog.push({ timestamp: Date.now(), agentId, action });
  if (activityLog.length > maxSize) {
    activityLog.shift();
  }
}

/**
 * Validate a finding type is one of the allowed types.
 * @param {string} type — the finding type to validate
 * @throws {Error} if type is invalid
 */
export function validateFindingType(type) {
  if (!ALL_FINDING_TYPES.includes(type)) {
    throw new Error(`Invalid finding type "${type}". Must be one of: ${ALL_FINDING_TYPES.join(', ')}`);
  }
}

/**
 * Validate a message type is one of the allowed types.
 * @param {string} type — the message type to validate
 * @throws {Error} if type is invalid
 */
export function validateMessageType(type) {
  if (!ALL_MESSAGE_TYPES.includes(type)) {
    throw new Error(`Invalid message type "${type}". Must be one of: ${ALL_MESSAGE_TYPES.join(', ')}`);
  }
}

/**
 * Clamp a value between min and max.
 * @param {number} value — the value to clamp
 * @param {number} min — minimum value
 * @param {number} max — maximum value
 * @returns {number} clamped value
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Normalize a finding object with defaults and sanitization.
 * @param {object} finding — raw finding input
 * @returns {{ type: string, content: string, confidence: number, tags: string[], relatedFiles: string[], source: string }}
 */
export function normalizeFinding(finding) {
  return {
    type: finding.type,
    content: String(finding.content ?? ''),
    confidence: clamp(Number(finding.confidence ?? 0.5), 0, 1),
    tags: Array.isArray(finding.tags) ? finding.tags.map(String) : [],
    relatedFiles: Array.isArray(finding.relatedFiles) ? finding.relatedFiles.map(String) : [],
    source: String(finding.source ?? 'unknown'),
  };
}

/**
 * Normalize a message object with defaults and sanitization.
 * @param {object} message — raw message input
 * @returns {{ type: string, content: string, data?: any, replyTo?: string }}
 */
export function normalizeMessage(message) {
  return {
    type: message.type,
    content: String(message.content ?? ''),
    data: message.data ?? undefined,
    replyTo: message.replyTo ?? undefined,
  };
}

/**
 * Create a blackboard entry from normalized finding data.
 * @param {string} findingId — generated finding ID
 * @param {string} agentId — posting agent ID
 * @param {object} normalizedFinding — normalized finding object
 * @returns {{ findingId: string, agentId: string, finding: object, timestamp: number }}
 */
export function createBlackboardEntry(findingId, agentId, normalizedFinding) {
  return {
    findingId,
    agentId,
    finding: normalizedFinding,
    timestamp: Date.now(),
  };
}

/**
 * Create a message envelope from normalized message data.
 * @param {string} messageId — generated message ID
 * @param {string} fromAgentId — sender agent ID
 * @param {string} toAgentId — recipient agent ID
 * @param {object} normalizedMessage — normalized message object
 * @returns {{ messageId: string, from: string, to: string, message: object, timestamp: number, read: boolean }}
 */
export function createMessageEnvelope(messageId, fromAgentId, toAgentId, normalizedMessage) {
  return {
    messageId,
    from: fromAgentId,
    to: toAgentId,
    message: normalizedMessage,
    timestamp: Date.now(),
    read: false,
  };
}

/**
 * Normalize agent metadata with defaults and sanitization.
 * @param {object} metadata — raw agent metadata
 * @returns {{ role: string, goalId: string, capabilities: string[], status: string, registeredAt: number }}
 */
export function normalizeAgentMetadata(metadata) {
  return {
    role: String(metadata.role ?? 'unknown'),
    goalId: String(metadata.goalId ?? ''),
    capabilities: Array.isArray(metadata.capabilities) ? metadata.capabilities.map(String) : [],
    status: metadata.status ?? AgentStatus.IDLE,
    registeredAt: Date.now(),
  };
}

/**
 * Count total messages across all inboxes.
 * @param {Map<string, Array<object>>} inboxes — map of agent inboxes
 * @returns {number} total message count
 */
export function countTotalMessages(inboxes) {
  let count = 0;
  for (const inbox of inboxes.values()) {
    count += inbox.length;
  }
  return count;
}

/**
 * Build communication graph edges from inboxes for agents in a goal.
 * @param {Map<string, Array<object>>} inboxes — map of agent inboxes
 * @param {Set<string>} goalAgents — set of agent IDs in the goal
 * @returns {Array<{ from: string, to: string, count: number }>}
 */
export function buildCommunicationEdges(inboxes, goalAgents) {
  /** @type {Map<string, number>} */
  const edgeCounts = new Map();

  for (const [recipientId, inbox] of inboxes.entries()) {
    if (!goalAgents.has(recipientId)) continue;
    for (const envelope of inbox) {
      if (!goalAgents.has(envelope.from)) continue;
      const key = `${envelope.from}->${recipientId}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  const edges = [];
  for (const [key, count] of edgeCounts.entries()) {
    const [from, to] = key.split('->');
    edges.push({ from, to, count });
  }

  return edges;
}

/**
 * Filter blackboard entries by query criteria.
 * @param {Map<string, object>} blackboard — the blackboard map
 * @param {string[]} queryTokens — tokenized query
 * @param {object} filters — filter options
 * @param {string[]} [filters.types] — filter by finding types
 * @param {string[]} [filters.tags] — filter by required tags
 * @param {number} [filters.minConfidence=0] — minimum confidence threshold
 * @param {string|null} [filters.relatedTo=null] — filter by related file
 * @returns {Array<{ findingId: string, agentId: string, finding: object, relevance: number }>}
 */
export function filterAndScoreFindings(blackboard, queryTokens, filters = {}) {
  const types = filters.types ?? ALL_FINDING_TYPES;
  const tags = filters.tags ?? [];
  const minConfidence = filters.minConfidence ?? 0;
  const relatedTo = filters.relatedTo ?? null;

  const results = [];

  for (const entry of blackboard.values()) {
    const f = entry.finding;

    // Filter by type
    if (!types.includes(f.type)) continue;

    // Filter by confidence
    if (f.confidence < minConfidence) continue;

    // Filter by related file
    if (relatedTo && !f.relatedFiles.includes(relatedTo)) continue;

    // Filter by tags (at least one must match if tags are specified)
    if (tags.length > 0) {
      const hasTagOverlap = tags.some((t) => f.tags.includes(t));
      if (!hasTagOverlap) continue;
    }

    // Compute relevance score
    const relevance = scoreRelevance(queryTokens, f, entry.timestamp);
    results.push({
      findingId: entry.findingId,
      agentId: entry.agentId,
      finding: f,
      relevance,
    });
  }

  return results;
}
