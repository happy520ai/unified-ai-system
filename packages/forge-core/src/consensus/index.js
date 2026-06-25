/**
 * ConsensusEngine — multi-agent consensus protocol for critical decisions.
 *
 * When agents need to make a collective decision (e.g. choosing an architecture
 * approach, resolving conflicting findings, or approving a plan), the consensus
 * engine manages the full lifecycle:
 *
 *   1. **Propose** — an agent initiates a consensus round with options.
 *   2. **Vote** — eligible agents cast votes with confidence and reasoning.
 *   3. **Resolve** — once quorum is met (or timeout expires), the round is resolved
 *      using a configurable strategy (majority, weighted, unanimous, expert).
 *
 * All state is in-memory. Resolved rounds are retained in a history buffer.
 *
 * Usage:
 *   import { ConsensusEngine } from './consensus/index.js';
 *   const engine = new ConsensusEngine({ minVoters: 3, quorumRatio: 0.6 });
 *
 *   const roundId = await engine.propose('agent-1', {
 *     topic: 'Database choice',
 *     options: ['PostgreSQL', 'SQLite', 'MongoDB'],
 *     recommendation: 'PostgreSQL',
 *     context: 'We need relational data with strong consistency.',
 *     urgency: 'medium',
 *   });
 *
 *   engine.vote(roundId, 'agent-2', { option: 'PostgreSQL', confidence: 0.9, reasoning: 'Best fit for relational data.' });
 *   engine.vote(roundId, 'agent-3', { option: 'PostgreSQL', confidence: 0.8, reasoning: 'Agree, mature ecosystem.' });
 *
 *   const result = engine.resolve(roundId, 'majority');
 *   // { resolved: true, winner: 'PostgreSQL', confidence: 0.85, ... }
 */

import {
  ConsensusStrategy,
  ProposalUrgency,
  RoundStatus,
  ALL_STRATEGIES,
  ALL_URGENCY_LEVELS,
  uid,
  timeoutForUrgency,
  buildUnresolved,
  findLeadingOption,
  resolveMajority,
  resolveWeighted,
  resolveUnanimous,
  resolveExpert,
  queryActiveRounds,
  queryHistory,
  queryStatus,
} from './helpers.js';

// Re-export enumerations and constants for backward compatibility
export { ConsensusStrategy, ProposalUrgency, RoundStatus };

export class ConsensusEngine {
  /** @type {Map<string, object>} active and recent rounds keyed by roundId */
  #rounds = new Map();

  /** @type {object[]} history of resolved/finished rounds */
  #history = [];

  /** @type {number} minimum voters required for quorum */
  #minVoters;

  /** @type {number} ratio of eligible voters needed for quorum (0-1) */
  #quorumRatio;

  /** @type {number} default timeout for a round in milliseconds */
  #timeoutMs;

  /** @type {string[]} available resolution strategies */
  #strategies;

  /** @type {number} maximum entries in the history buffer */
  #historyMax = 200;

  /**
   * @param {object} [opts]
   * @param {number} [opts.minVoters=2] — minimum number of voters for quorum
   * @param {number} [opts.quorumRatio=0.6] — ratio of eligible voters needed
   * @param {number} [opts.timeoutMs=30000] — default round timeout (ms)
   * @param {string[]} [opts.strategies] — available strategies
   */
  constructor(opts = {}) {
    this.#minVoters = opts.minVoters ?? 2;
    this.#quorumRatio = opts.quorumRatio ?? 0.6;
    this.#timeoutMs = opts.timeoutMs ?? 30_000;
    this.#strategies = opts.strategies ?? [...ALL_STRATEGIES];
  }

  // ── Propose ────────────────────────────────────────────────────────────────

  /**
   * Initiate a new consensus round.
   *
   * @param {string} proposerId — the agent proposing the decision
   * @param {import('./helpers.js').Proposal} proposal — the proposal details
   * @returns {Promise<string>} the generated roundId
   * @throws {Error} if the proposal is invalid
   */
  async propose(proposerId, proposal) {
    if (!proposal.topic || typeof proposal.topic !== 'string') {
      throw new Error('Proposal must include a non-empty topic.');
    }
    if (!Array.isArray(proposal.options) || proposal.options.length < 2) {
      throw new Error('Proposal must include at least two options.');
    }
    const urgency = proposal.urgency ?? ProposalUrgency.MEDIUM;
    if (!ALL_URGENCY_LEVELS.includes(urgency)) {
      throw new Error(`Invalid urgency "${urgency}". Must be one of: ${ALL_URGENCY_LEVELS.join(', ')}`);
    }

    const roundId = uid('round');
    const now = Date.now();
    const timeoutMs = timeoutForUrgency(urgency, this.#timeoutMs);

    const round = {
      roundId,
      proposerId,
      proposal: {
        topic: proposal.topic,
        options: proposal.options.map(String),
        recommendation: proposal.recommendation ?? null,
        context: proposal.context ?? null,
        urgency,
        deadline: proposal.deadline ?? (now + timeoutMs),
      },
      /** @type {Map<string, { option: string, confidence: number, reasoning: string, timestamp: number }>} */
      votes: new Map(),
      eligibleVoters: new Set(),
      status: RoundStatus.ACTIVE,
      createdAt: now,
      resolvedAt: null,
      resolution: null,
    };

    this.#rounds.set(roundId, round);
    return roundId;
  }

  /**
   * Register an agent as an eligible voter for a round.
   *
   * @param {string} roundId
   * @param {string} voterId
   * @returns {boolean} true if the round exists and the voter was added
   */
  addVoter(roundId, voterId) {
    const round = this.#rounds.get(roundId);
    if (!round || round.status !== RoundStatus.ACTIVE) return false;
    round.eligibleVoters.add(voterId);
    return true;
  }

  /**
   * Register multiple voters for a round.
   *
   * @param {string} roundId
   * @param {string[]} voterIds
   * @returns {number} number of voters added
   */
  addVoters(roundId, voterIds) {
    let count = 0;
    for (const id of voterIds) {
      if (this.addVoter(roundId, id)) count++;
    }
    return count;
  }

  // ── Vote ───────────────────────────────────────────────────────────────────

  /**
   * Cast a vote in a consensus round.
   *
   * @param {string} roundId — the round to vote in
   * @param {string} voterId — the agent casting the vote
   * @param {import('./helpers.js').Vote} vote — the vote details
   * @returns {{ accepted: boolean, currentTally: object }}
   * @throws {Error} if the round is not active or the option is invalid
   */
  vote(roundId, voterId, vote) {
    const round = this.#rounds.get(roundId);
    if (!round) throw new Error(`Round "${roundId}" not found.`);
    if (round.status !== RoundStatus.ACTIVE) {
      return { accepted: false, currentTally: this.getTally(roundId) };
    }

    // Validate option
    if (!round.proposal.options.includes(vote.option)) {
      throw new Error(
        `Invalid option "${vote.option}". Must be one of: ${round.proposal.options.join(', ')}`
      );
    }

    // Record or update the vote
    round.votes.set(voterId, {
      option: vote.option,
      confidence: Math.max(0, Math.min(1, Number(vote.confidence ?? 0.5))),
      reasoning: String(vote.reasoning ?? ''),
      timestamp: Date.now(),
    });

    const tally = this.getTally(roundId);
    return { accepted: true, currentTally: tally };
  }

  // ── Tally ──────────────────────────────────────────────────────────────────

  /**
   * Get the current tally for a round.
   *
   * @param {string} roundId
   * @returns {{
   *   votes: Record<string, Array<{ voterId: string, confidence: number, reasoning: string }>>,
   *   totalEligible: number,
   *   votedCount: number,
   *   quorumMet: boolean,
   *   leadingOption: string|null,
   * }}
   */
  getTally(roundId) {
    const round = this.#rounds.get(roundId);
    if (!round) {
      return {
        votes: {},
        totalEligible: 0,
        votedCount: 0,
        quorumMet: false,
        leadingOption: null,
      };
    }

    // Group votes by option
    /** @type {Record<string, Array<{ voterId: string, confidence: number, reasoning: string }>>} */
    const votes = {};
    for (const option of round.proposal.options) {
      votes[option] = [];
    }

    for (const [voterId, v] of round.votes.entries()) {
      if (!votes[v.option]) votes[v.option] = [];
      votes[v.option].push({
        voterId,
        confidence: v.confidence,
        reasoning: v.reasoning,
      });
    }

    const votedCount = round.votes.size;
    const totalEligible = Math.max(round.eligibleVoters.size, votedCount);
    const quorumThreshold = Math.max(
      this.#minVoters,
      Math.ceil(totalEligible * this.#quorumRatio)
    );
    const quorumMet = votedCount >= quorumThreshold;

    // Determine leading option using shared helper
    const { option: leadingOption } = findLeadingOption({ votes });

    return {
      votes,
      totalEligible,
      votedCount,
      quorumMet,
      leadingOption,
    };
  }

  // ── Resolve ────────────────────────────────────────────────────────────────

  /**
   * Resolve a consensus round using the specified strategy.
   *
   * Strategies:
   *   - `'majority'`: the option with the most votes wins.
   *   - `'weighted'`: votes are weighted by confidence score.
   *   - `'unanimous'`: all voters must agree on the same option (or abstain).
   *   - `'expert'`: the vote with the highest confidence wins.
   *
   * @param {string} roundId — the round to resolve
   * @param {string} [strategy='majority'] — resolution strategy
   * @returns {import('./helpers.js').ResolutionResult}
   * @throws {Error} if the round is not found or the strategy is invalid
   */
  resolve(roundId, strategy = 'majority') {
    const round = this.#rounds.get(roundId);
    if (!round) throw new Error(`Round "${roundId}" not found.`);
    if (!ALL_STRATEGIES.includes(strategy)) {
      throw new Error(`Invalid strategy "${strategy}". Must be one of: ${ALL_STRATEGIES.join(', ')}`);
    }

    if (round.votes.size === 0) {
      return buildUnresolved(round, 'No votes cast.', strategy);
    }

    const tally = this.getTally(roundId);

    let result;
    switch (strategy) {
      case ConsensusStrategy.MAJORITY:
        result = resolveMajority(round, tally);
        break;
      case ConsensusStrategy.WEIGHTED:
        result = resolveWeighted(round, tally);
        break;
      case ConsensusStrategy.UNANIMOUS:
        result = resolveUnanimous(round, tally);
        break;
      case ConsensusStrategy.EXPERT:
        result = resolveExpert(round);
        break;
      default:
        result = buildUnresolved(round, 'Unknown strategy.', strategy);
    }

    // Finalize the round
    round.status = RoundStatus.RESOLVED;
    round.resolvedAt = Date.now();
    round.resolution = result;
    this.#archiveRound(round);

    return result;
  }

  /**
   * Auto-resolve a round: if quorum is met resolve with available votes,
   * otherwise return partial results without resolving.
   *
   * @param {string} roundId
   * @param {string} [strategy='majority']
   * @returns {import('./helpers.js').ResolutionResult}
   */
  autoResolve(roundId, strategy = 'majority') {
    const round = this.#rounds.get(roundId);
    if (!round) throw new Error(`Round "${roundId}" not found.`);

    const tally = this.getTally(roundId);

    if (tally.quorumMet) {
      return this.resolve(roundId, strategy);
    }

    // Quorum not met — return partial results
    round.status = RoundStatus.TIMED_OUT;
    round.resolvedAt = Date.now();

    const partial = buildUnresolved(round, 'Quorum not met — partial results only.', strategy);
    round.resolution = partial;
    this.#archiveRound(round);

    return partial;
  }

  /**
   * Cancel an active round without resolving.
   *
   * @param {string} roundId
   * @param {string} [reason=''] — reason for cancellation
   * @returns {boolean} true if cancelled
   */
  cancel(roundId, reason = '') {
    const round = this.#rounds.get(roundId);
    if (!round || round.status !== RoundStatus.ACTIVE) return false;

    round.status = RoundStatus.CANCELLED;
    round.resolvedAt = Date.now();
    round.resolution = buildUnresolved(round, reason || 'Cancelled by caller.', 'none');
    this.#archiveRound(round);
    return true;
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  /**
   * Get all currently active rounds.
   * @returns {Array<{ roundId: string, topic: string, urgency: string, votesCast: number, createdAt: number }>}
   */
  getActiveRounds() {
    return queryActiveRounds(this.#rounds);
  }

  /**
   * Get history of resolved/finished rounds.
   * @param {object} [opts]
   * @param {number} [opts.limit=20]
   * @param {string} [opts.topic]
   * @returns {Array<{ roundId: string, topic: string, status: string, winner: string|null, resolvedAt: number, strategy: string }>}
   */
  getHistory(opts = {}) {
    return queryHistory(this.#history, opts);
  }

  /**
   * Get a specific round by id (active or historical).
   *
   * @param {string} roundId
   * @returns {object|null}
   */
  getRound(roundId) {
    const round = this.#rounds.get(roundId);
    if (!round) return null;

    return {
      roundId: round.roundId,
      proposerId: round.proposerId,
      proposal: { ...round.proposal },
      status: round.status,
      votesCast: round.votes.size,
      createdAt: round.createdAt,
      resolvedAt: round.resolvedAt,
      resolution: round.resolution,
    };
  }

  /**
   * Get overall status of the consensus engine.
   * @returns {{ activeRounds: number, resolvedCount: number, timedOutCount: number, cancelledCount: number, avgResolutionTimeMs: number }}
   */
  getStatus() {
    return queryStatus(this.#rounds);
  }

  /**
   * Clear all rounds and history.
   */
  clear() {
    this.#rounds.clear();
    this.#history = [];
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  /**
   * Archive a finished round into the history buffer.
   * @param {object} round
   */
  #archiveRound(round) {
    this.#history.push({
      roundId: round.roundId,
      topic: round.proposal.topic,
      status: round.status,
      winner: round.resolution?.winner ?? null,
      resolvedAt: round.resolvedAt ?? Date.now(),
      strategy: round.resolution?.strategy ?? 'unknown',
      votesCast: round.votes.size,
    });

    // Ring buffer eviction
    if (this.#history.length > this.#historyMax) {
      this.#history.shift();
    }
  }
}
