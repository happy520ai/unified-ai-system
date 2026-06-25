/**
 * AgentCommunication — inter-agent communication via shared blackboard + direct messaging.
 *
 * Provides a coordination layer for autonomous agents working on shared goals:
 *   - Blackboard: shared knowledge space for findings (discoveries, constraints, patterns, risks, decisions)
 *   - Direct Messaging: point-to-point and broadcast messages between agents
 *   - Agent Registry: tracks active agents, roles, and status
 *
 * All state is in-memory. Events emitted via node:events EventEmitter.
 *
 * @example
 *   import { AgentCommunication } from './agent-communication/index.js';
 *   const comm = new AgentCommunication({ maxMessages: 2000 });
 *   comm.registerAgent('agent-1', { role: 'coder', goalId: 'g1', capabilities: ['js'], status: 'working' });
 *   const findingId = comm.postFinding('agent-1', { type: 'discovery', content: 'Auth uses JWT', confidence: 0.9 });
 *   const results = comm.queryFindings('auth jwt', { tags: ['auth'], minConfidence: 0.5 });
 */

import { EventEmitter } from 'node:events';

import {
  FindingType, MessageType, AgentStatus,
  ALL_FINDING_TYPES, ALL_MESSAGE_TYPES,
  uid, tokenize, evictBlackboard, expireMessages, logActivity,
  validateFindingType, validateMessageType,
  normalizeFinding, normalizeMessage, createBlackboardEntry, createMessageEnvelope,
  normalizeAgentMetadata, countTotalMessages, buildCommunicationEdges,
  filterAndScoreFindings,
} from './helpers.js';

// Re-export enumerations and constants so existing consumers keep working.
export { FindingType, MessageType, AgentStatus, ALL_FINDING_TYPES, ALL_MESSAGE_TYPES };

// ── AgentCommunication class ──────────────────────────────────────────────────

/**
 * @typedef {object} Finding
 * @property {string} type — one of FindingType
 * @property {string} content — human-readable description
 * @property {number} confidence — 0 to 1
 * @property {string[]} tags — keyword tags
 * @property {string[]} relatedFiles — related file paths
 * @property {string} source — origin of the finding
 */

/**
 * @typedef {object} Message
 * @property {string} type — one of MessageType
 * @property {string} content — human-readable message body
 * @property {any} [data] — optional structured payload
 * @property {string} [replyTo] — optional message id this is a reply to
 */

/**
 * @typedef {object} AgentMetadata
 * @property {string} role — agent role (e.g. 'coder', 'tester')
 * @property {string} goalId — goal the agent is working on
 * @property {string[]} capabilities — list of capability tags
 * @property {string} status — one of AgentStatus
 */

export class AgentCommunication extends EventEmitter {
  /** @type {Map<string, object>} blackboard entries keyed by findingId */
  #blackboard = new Map();

  /** @type {Map<string, object[]>} message inboxes keyed by recipient agentId */
  #inboxes = new Map();

  /** @type {Map<string, AgentMetadata>} registered agents keyed by agentId */
  #agents = new Map();

  /** @type {number} maximum messages to retain per inbox */
  #maxMessages;

  /** @type {number} how long messages are retained in milliseconds */
  #messageRetentionMs;

  /** @type {number} maximum entries on the blackboard */
  #maxBoardEntries;

  /** @type {Array<{ timestamp: number, agentId: string, action: string }>} recent activity log */
  #activityLog = [];

  /** @type {number} maximum entries in the activity log */
  #activityLogMax = 500;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxMessages=1000] — max messages retained per inbox
   * @param {number} [opts.messageRetentionMs=300000] — message retention (default: 5 min)
   * @param {number} [opts.maxBoardEntries=200] — max blackboard entries
   */
  constructor(opts = {}) {
    super();
    this.#maxMessages = opts.maxMessages ?? 1000;
    this.#messageRetentionMs = opts.messageRetentionMs ?? 300_000;
    this.#maxBoardEntries = opts.maxBoardEntries ?? 200;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── Blackboard (shared knowledge space) ────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Post a finding to the shared blackboard, visible to all agents.
   *
   * @param {string} agentId — the agent posting the finding
   * @param {Finding} finding — the finding to post
   * @returns {string} the generated findingId
   * @throws {Error} if the agent is not registered or the finding type is invalid
   */
  postFinding(agentId, finding) {
    this.#requireRegistered(agentId);
    validateFindingType(finding.type);

    const findingId = uid('finding');
    const normalized = normalizeFinding(finding);
    const entry = createBlackboardEntry(findingId, agentId, normalized);

    this.#blackboard.set(findingId, entry);
    evictBlackboard(this.#blackboard, this.#maxBoardEntries);
    logActivity(this.#activityLog, agentId, 'postFinding', this.#activityLogMax);

    /** @emits AgentCommunication#finding */
    this.emit('finding', { findingId, agentId, finding: entry.finding });

    return findingId;
  }

  /**
   * Query the blackboard for relevant findings.
   *
   * Relevance is scored by:
   *   - tag overlap with query tokens
   *   - keyword overlap between query and content
   *   - recency (more recent = higher score)
   *
   * @param {string} query — natural language query
   * @param {object} [opts]
   * @param {string[]} [opts.types] — filter by finding types
   * @param {string[]} [opts.tags] — filter by required tags (at least one must match)
   * @param {number} [opts.minConfidence=0] — minimum confidence threshold
   * @param {number} [opts.limit=10] — max results
   * @param {string} [opts.relatedTo] — file path to filter by relatedFiles
   * @returns {Array<{ findingId: string, agentId: string, finding: Finding, relevance: number }>}
   */
  queryFindings(query, opts = {}) {
    const queryTokens = tokenize(query);
    const limit = opts.limit ?? 10;

    const results = filterAndScoreFindings(this.#blackboard, queryTokens, opts);

    // Sort by relevance descending, then by recency
    results.sort((a, b) => b.relevance - a.relevance);

    return results.slice(0, limit);
  }

  /**
   * Get a single finding by its id.
   *
   * @param {string} findingId
   * @returns {object|null} the blackboard entry, or null
   */
  getFinding(findingId) {
    return this.#blackboard.get(findingId) ?? null;
  }

  /**
   * Remove a finding from the blackboard.
   *
   * @param {string} agentId — the agent requesting removal
   * @param {string} findingId — the finding to remove
   * @returns {boolean} true if removed
   */
  removeFinding(agentId, findingId) {
    const entry = this.#blackboard.get(findingId);
    if (!entry) return false;

    // Only the original poster or any agent can remove (flexible policy)
    this.#blackboard.delete(findingId);
    logActivity(this.#activityLog, agentId, 'removeFinding', this.#activityLogMax);
    this.emit('findingRemoved', { findingId, agentId });
    return true;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── Direct Messaging ───────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Send a message from one agent to another.
   *
   * @param {string} fromAgentId — sender agent id
   * @param {string} toAgentId — recipient agent id
   * @param {Message} message — the message to send
   * @returns {string} the generated messageId
   * @throws {Error} if sender is not registered or message type is invalid
   */
  sendMessage(fromAgentId, toAgentId, message) {
    this.#requireRegistered(fromAgentId);
    validateMessageType(message.type);

    const messageId = uid('msg');
    const normalized = normalizeMessage(message);
    const envelope = createMessageEnvelope(messageId, fromAgentId, toAgentId, normalized);

    // Ensure inbox exists for the recipient
    if (!this.#inboxes.has(toAgentId)) {
      this.#inboxes.set(toAgentId, []);
    }

    const inbox = this.#inboxes.get(toAgentId);
    inbox.push(envelope);

    // Evict oldest messages if over capacity
    while (inbox.length > this.#maxMessages) {
      inbox.shift();
    }

    logActivity(this.#activityLog, fromAgentId, 'sendMessage', this.#activityLogMax);

    /** @emits AgentCommunication#message */
    this.emit('message', { messageId, from: fromAgentId, to: toAgentId, message: envelope.message });

    return messageId;
  }

  /**
   * Get pending messages for an agent.
   *
   * @param {string} agentId — the recipient agent
   * @param {object} [opts]
   * @param {string[]} [opts.types] — filter by message types
   * @param {number} [opts.since] — only return messages after this timestamp
   * @param {number} [opts.limit=20] — max messages to return
   * @param {boolean} [opts.markRead=true] — mark returned messages as read
   * @returns {Array<{ messageId: string, from: string, message: Message, timestamp: number, read: boolean }>}
   */
  getMessages(agentId, opts = {}) {
    const types = opts.types ?? ALL_MESSAGE_TYPES;
    const since = opts.since ?? 0;
    const limit = opts.limit ?? 20;
    const markRead = opts.markRead ?? true;

    const inbox = this.#inboxes.get(agentId);
    if (!inbox) return [];

    // Expire old messages
    expireMessages(inbox, this.#messageRetentionMs);

    const results = [];
    for (const envelope of inbox) {
      if (!types.includes(envelope.message.type)) continue;
      if (envelope.timestamp < since) continue;

      results.push({
        messageId: envelope.messageId,
        from: envelope.from,
        message: envelope.message,
        timestamp: envelope.timestamp,
        read: envelope.read,
      });

      if (markRead) {
        envelope.read = true;
      }

      if (results.length >= limit) break;
    }

    return results;
  }

  /**
   * Broadcast a message to all registered agents except the sender.
   *
   * @param {string} fromAgentId — sender agent id
   * @param {Message} message — the message to broadcast
   * @returns {string[]} array of messageIds (one per recipient)
   */
  broadcast(fromAgentId, message) {
    this.#requireRegistered(fromAgentId);

    const messageIds = [];
    for (const agentId of this.#agents.keys()) {
      if (agentId === fromAgentId) continue;
      const id = this.sendMessage(fromAgentId, agentId, message);
      messageIds.push(id);
    }

    logActivity(this.#activityLog, fromAgentId, 'broadcast', this.#activityLogMax);

    /** @emits AgentCommunication#broadcast */
    this.emit('broadcast', { from: fromAgentId, message, recipientCount: messageIds.length });

    return messageIds;
  }

  /**
   * Mark a specific message as read.
   *
   * @param {string} agentId — the recipient agent
   * @param {string} messageId — the message to mark
   * @returns {boolean} true if the message was found and marked
   */
  markRead(agentId, messageId) {
    const inbox = this.#inboxes.get(agentId);
    if (!inbox) return false;

    for (const envelope of inbox) {
      if (envelope.messageId === messageId) {
        envelope.read = true;
        return true;
      }
    }
    return false;
  }

  /**
   * Get the count of unread messages for an agent.
   *
   * @param {string} agentId
   * @returns {number}
   */
  getUnreadCount(agentId) {
    const inbox = this.#inboxes.get(agentId);
    if (!inbox) return 0;
    return inbox.filter((e) => !e.read).length;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── Agent Registry ─────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Register an agent in the communication system.
   *
   * @param {string} agentId — unique agent identifier
   * @param {AgentMetadata} metadata — agent role, goal, capabilities, and status
   */
  registerAgent(agentId, metadata) {
    this.#agents.set(agentId, normalizeAgentMetadata(metadata));

    // Ensure the agent has an inbox
    if (!this.#inboxes.has(agentId)) {
      this.#inboxes.set(agentId, []);
    }

    logActivity(this.#activityLog, agentId, 'register', this.#activityLogMax);

    /** @emits AgentCommunication#agentRegistered */
    this.emit('agentRegistered', { agentId, metadata: this.#agents.get(agentId) });
  }

  /**
   * Unregister an agent, removing it from the registry.
   *
   * @param {string} agentId — the agent to unregister
   * @returns {boolean} true if the agent was registered and removed
   */
  unregisterAgent(agentId) {
    if (!this.#agents.has(agentId)) return false;

    this.#agents.delete(agentId);
    this.#inboxes.delete(agentId);
    logActivity(this.#activityLog, agentId, 'unregister', this.#activityLogMax);

    /** @emits AgentCommunication#agentUnregistered */
    this.emit('agentUnregistered', { agentId });
    return true;
  }

  /**
   * Update an agent's status.
   *
   * @param {string} agentId
   * @param {string} status — one of AgentStatus
   */
  updateAgentStatus(agentId, status) {
    const agent = this.#agents.get(agentId);
    if (!agent) return;
    agent.status = status;
    this.emit('agentStatusChanged', { agentId, status });
  }

  /**
   * Get all registered agents, optionally filtered by goalId.
   *
   * @param {string} [goalId] — filter by goal
   * @returns {Array<{ agentId: string, metadata: AgentMetadata }>}
   */
  getRegisteredAgents(goalId) {
    const results = [];
    for (const [agentId, metadata] of this.#agents.entries()) {
      if (goalId && metadata.goalId !== goalId) continue;
      results.push({ agentId, metadata: { ...metadata } });
    }
    return results;
  }

  /**
   * Get a single agent's metadata.
   *
   * @param {string} agentId
   * @returns {AgentMetadata|null}
   */
  getAgent(agentId) {
    const meta = this.#agents.get(agentId);
    return meta ? { ...meta } : null;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── Status & Stats ─────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get an overall status snapshot of the communication system.
   *
   * @returns {{
   *   agentCount: number,
   *   messageCount: number,
   *   boardEntries: number,
   *   recentActivity: Array<{ timestamp: number, agentId: string, action: string }>,
   * }}
   */
  getStatus() {
    return {
      agentCount: this.#agents.size,
      messageCount: countTotalMessages(this.#inboxes),
      boardEntries: this.#blackboard.size,
      recentActivity: this.#activityLog.slice(-20),
    };
  }

  /**
   * Get a communication graph for a goal — who talked to whom and how many messages.
   *
   * @param {string} goalId — the goal to build the graph for
   * @returns {{
   *   nodes: Array<{ agentId: string, role: string }>,
   *   edges: Array<{ from: string, to: string, count: number }>,
   * }}
   */
  getCommunicationGraph(goalId) {
    // Collect agents for this goal
    const goalAgents = new Set();
    for (const [agentId, meta] of this.#agents.entries()) {
      if (meta.goalId === goalId) goalAgents.add(agentId);
    }

    const nodes = [];
    for (const agentId of goalAgents) {
      const meta = this.#agents.get(agentId);
      nodes.push({ agentId, role: meta.role });
    }

    return { nodes, edges: buildCommunicationEdges(this.#inboxes, goalAgents) };
  }

  /**
   * Reset all communication state: blackboard, inboxes, agents, activity log.
   */
  clear() {
    this.#blackboard.clear();
    this.#inboxes.clear();
    this.#agents.clear();
    this.#activityLog = [];
    this.emit('cleared');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── Internal Helpers ───────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Assert that an agent is registered.
   * @param {string} agentId
   * @throws {Error} if not registered
   */
  #requireRegistered(agentId) {
    if (!this.#agents.has(agentId)) {
      throw new Error(`Agent "${agentId}" is not registered. Call registerAgent() first.`);
    }
  }
}
