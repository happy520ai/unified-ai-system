/**
 * helpers.js — Pure functions, constants, and typedefs for ConsensusEngine.
 * Extracted from index.js to reduce class file size below 500 lines.
 */

// ── Enumerations ──────────────────────────────────────────────────────────────

/**
 * Resolution strategies for consensus rounds.
 * @readonly
 * @enum {string}
 */
export const ConsensusStrategy = Object.freeze({
  MAJORITY: 'majority',
  WEIGHTED: 'weighted',
  UNANIMOUS: 'unanimous',
  EXPERT: 'expert',
});

/**
 * Urgency levels for proposals.
 * @readonly
 * @enum {string}
 */
export const ProposalUrgency = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

/**
 * Possible states of a consensus round.
 * @readonly
 * @enum {string}
 */
export const RoundStatus = Object.freeze({
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  TIMED_OUT: 'timed_out',
  CANCELLED: 'cancelled',
});

/** All valid strategies as an array. */
export const ALL_STRATEGIES = Object.values(ConsensusStrategy);

/** All valid urgency levels as an array. */
export const ALL_URGENCY_LEVELS = Object.values(ProposalUrgency);

// ── JSDoc Typedefs ────────────────────────────────────────────────────────────

/**
 * @typedef {object} Proposal
 * @property {string} topic — decision topic
 * @property {string[]} options — list of options to choose from
 * @property {string} [recommendation] — proposer's recommended option
 * @property {string} [context] — additional context for voters
 * @property {string} urgency — one of ProposalUrgency
 * @property {number} [deadline] — optional deadline timestamp (ms)
 */

/**
 * @typedef {object} Vote
 * @property {string} option — the chosen option
 * @property {number} confidence — 0 to 1
 * @property {string} reasoning — explanation for the vote
 */

/**
 * @typedef {object} ResolutionResult
 * @property {boolean} resolved — whether the round was successfully resolved
 * @property {string|null} winner — the winning option (null if unresolved)
 * @property {number} confidence — aggregated confidence in the result
 * @property {object} votes — full vote breakdown per option
 * @property {string[]} reasoning — collected reasoning from all voters
 * @property {string} strategy — the strategy used for resolution
 */

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Generate a short unique identifier.
 * @param {string} [prefix='id'] — optional prefix
 * @returns {string}
 */
export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Compute the timeout for a round based on urgency.
 * @param {string} urgency
 * @param {number} baseTimeoutMs — base timeout in milliseconds
 * @returns {number} timeout in milliseconds
 */
export function timeoutForUrgency(urgency, baseTimeoutMs) {
  switch (urgency) {
    case ProposalUrgency.HIGH: return baseTimeoutMs * 0.5;
    case ProposalUrgency.LOW: return baseTimeoutMs * 2;
    default: return baseTimeoutMs;
  }
}

/**
 * Build an unresolved result.
 * @param {object} round
 * @param {string} reason
 * @param {string} strategy
 * @returns {ResolutionResult}
 */
export function buildUnresolved(round, reason, strategy) {
  return {
    resolved: false,
    winner: null,
    confidence: 0,
    votes: serializeVotes(round),
    reasoning: reason ? [reason] : [],
    strategy,
  };
}

/**
 * Serialize all votes in a round to a plain object.
 * @param {object} round
 * @returns {Record<string, Array<{ voterId: string, confidence: number, reasoning: string }>>}
 */
export function serializeVotes(round) {
  /** @type {Record<string, Array<{ voterId: string, confidence: number, reasoning: string }>>} */
  const serialized = {};
  for (const option of round.proposal.options) {
    serialized[option] = [];
  }
  for (const [voterId, v] of round.votes.entries()) {
    if (!serialized[v.option]) serialized[v.option] = [];
    serialized[v.option].push({
      voterId,
      confidence: v.confidence,
      reasoning: v.reasoning,
    });
  }
  return serialized;
}

/**
 * Collect all reasoning strings from votes in a round.
 * @param {object} round
 * @returns {string[]}
 */
export function collectReasoning(round) {
  const reasons = [];
  for (const [voterId, v] of round.votes.entries()) {
    if (v.reasoning) {
      reasons.push(`[${voterId}] ${v.reasoning}`);
    }
  }
  return reasons;
}

/**
 * Collect all votes as a flat array.
 * @param {object} round
 * @returns {Array<{ voterId: string, option: string, confidence: number }>}
 */
export function collectAllVotes(round) {
  const all = [];
  for (const [voterId, v] of round.votes.entries()) {
    all.push({ voterId, option: v.option, confidence: v.confidence });
  }
  return all;
}

/**
 * Find the leading option from a tally (most votes, tie-break by confidence).
 * @param {object} tally — result from getTally
 * @returns {{ option: string|null, count: number, totalConfidence: number }}
 */
export function findLeadingOption(tally) {
  let leadingOption = null;
  let leadingCount = 0;
  let leadingConfidence = 0;

  for (const [option, optionVotes] of Object.entries(tally.votes)) {
    const count = optionVotes.length;
    const totalConf = optionVotes.reduce((sum, v) => sum + v.confidence, 0);
    if (count > leadingCount || (count === leadingCount && totalConf > leadingConfidence)) {
      leadingOption = option;
      leadingCount = count;
      leadingConfidence = totalConf;
    }
  }

  return { option: leadingOption, count: leadingCount, totalConfidence: leadingConfidence };
}

/**
 * Majority strategy: option with the most votes wins.
 * Tie-break: higher total confidence.
 *
 * @param {object} round
 * @param {object} tally
 * @returns {ResolutionResult}
 */
export function resolveMajority(round, tally) {
  const { option: winner } = findLeadingOption(tally);

  const allVotes = collectAllVotes(round);
  const avgConfidence = allVotes.length > 0
    ? allVotes.reduce((s, v) => s + v.confidence, 0) / allVotes.length
    : 0;

  return {
    resolved: true,
    winner,
    confidence: Math.round(avgConfidence * 100) / 100,
    votes: serializeVotes(round),
    reasoning: collectReasoning(round),
    strategy: ConsensusStrategy.MAJORITY,
  };
}

/**
 * Weighted strategy: votes weighted by confidence score.
 *
 * @param {object} round
 * @param {object} tally
 * @returns {ResolutionResult}
 */
export function resolveWeighted(round, tally) {
  /** @type {Record<string, number>} */
  const weightedScores = {};

  for (const [option, optionVotes] of Object.entries(tally.votes)) {
    weightedScores[option] = optionVotes.reduce((s, v) => s + v.confidence, 0);
  }

  let winner = null;
  let bestScore = -1;

  for (const [option, score] of Object.entries(weightedScores)) {
    if (score > bestScore) {
      winner = option;
      bestScore = score;
    }
  }

  const totalWeight = Object.values(weightedScores).reduce((s, w) => s + w, 0);
  const confidence = totalWeight > 0 ? bestScore / totalWeight : 0;

  return {
    resolved: true,
    winner,
    confidence: Math.round(confidence * 100) / 100,
    votes: serializeVotes(round),
    reasoning: collectReasoning(round),
    strategy: ConsensusStrategy.WEIGHTED,
  };
}

/**
 * Unanimous strategy: all voters must agree on the same option.
 * If any voter chose differently, the round is unresolved.
 *
 * @param {object} round
 * @param {object} tally
 * @returns {ResolutionResult}
 */
export function resolveUnanimous(round, tally) {
  const optionsVoted = Object.entries(tally.votes)
    .filter(([, optionVotes]) => optionVotes.length > 0)
    .map(([option]) => option);

  if (optionsVoted.length === 1) {
    // Everyone agrees
    const winner = optionsVoted[0];
    const allVotes = collectAllVotes(round);
    const avgConfidence = allVotes.length > 0
      ? allVotes.reduce((s, v) => s + v.confidence, 0) / allVotes.length
      : 0;

    return {
      resolved: true,
      winner,
      confidence: Math.round(avgConfidence * 100) / 100,
      votes: serializeVotes(round),
      reasoning: collectReasoning(round),
      strategy: ConsensusStrategy.UNANIMOUS,
    };
  }

  // Not unanimous
  return {
    resolved: false,
    winner: null,
    confidence: 0,
    votes: serializeVotes(round),
    reasoning: [
      ...collectReasoning(round),
      `Unanimous resolution failed: voters split across ${optionsVoted.length} options.`,
    ],
    strategy: ConsensusStrategy.UNANIMOUS,
  };
}

/**
 * Expert strategy: the single highest-confidence vote wins.
 *
 * @param {object} round
 * @returns {ResolutionResult}
 */
export function resolveExpert(round) {
  let bestVote = null;
  let bestConfidence = -1;

  for (const [voterId, v] of round.votes.entries()) {
    if (v.confidence > bestConfidence) {
      bestVote = { voterId, ...v };
      bestConfidence = v.confidence;
    }
  }

  if (!bestVote) {
    return buildUnresolved(round, 'No votes cast.', ConsensusStrategy.EXPERT);
  }

  return {
    resolved: true,
    winner: bestVote.option,
    confidence: bestVote.confidence,
    votes: serializeVotes(round),
    reasoning: [
      `Expert vote by ${bestVote.voterId}: ${bestVote.reasoning}`,
    ],
    strategy: ConsensusStrategy.EXPERT,
  };
}

// ── Query Helpers ─────────────────────────────────────────────────────────────

/**
 * Get all currently active rounds from a rounds map.
 * @param {Map<string, object>} rounds
 * @returns {Array<{ roundId: string, topic: string, urgency: string, votesCast: number, createdAt: number }>}
 */
export function queryActiveRounds(rounds) {
  const results = [];
  for (const round of rounds.values()) {
    if (round.status !== RoundStatus.ACTIVE) continue;
    results.push({
      roundId: round.roundId,
      topic: round.proposal.topic,
      urgency: round.proposal.urgency,
      votesCast: round.votes.size,
      createdAt: round.createdAt,
    });
  }
  return results;
}

/**
 * Query history with optional topic filter and limit.
 * @param {object[]} history
 * @param {object} [opts]
 * @param {number} [opts.limit=20]
 * @param {string} [opts.topic]
 * @returns {Array<{ roundId: string, topic: string, status: string, winner: string|null, resolvedAt: number, strategy: string }>}
 */
export function queryHistory(history, opts = {}) {
  const limit = opts.limit ?? 20;
  const topicFilter = opts.topic?.toLowerCase() ?? null;
  let entries = [...history];
  if (topicFilter) {
    entries = entries.filter((e) => e.topic.toLowerCase().includes(topicFilter));
  }
  entries.sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0));
  return entries.slice(0, limit).map((e) => ({
    roundId: e.roundId,
    topic: e.topic,
    status: e.status,
    winner: e.winner,
    resolvedAt: e.resolvedAt,
    strategy: e.strategy,
  }));
}

/**
 * Compute aggregate status from a rounds map.
 * @param {Map<string, object>} rounds
 * @returns {{ activeRounds: number, resolvedCount: number, timedOutCount: number, cancelledCount: number, avgResolutionTimeMs: number }}
 */
export function queryStatus(rounds) {
  let active = 0, resolved = 0, timedOut = 0, cancelled = 0;
  let totalResolutionTime = 0, resolvedWithTime = 0;
  for (const round of rounds.values()) {
    switch (round.status) {
      case RoundStatus.ACTIVE: active++; break;
      case RoundStatus.RESOLVED:
        resolved++;
        if (round.resolvedAt && round.createdAt) {
          totalResolutionTime += round.resolvedAt - round.createdAt;
          resolvedWithTime++;
        }
        break;
      case RoundStatus.TIMED_OUT: timedOut++; break;
      case RoundStatus.CANCELLED: cancelled++; break;
    }
  }
  return {
    activeRounds: active,
    resolvedCount: resolved,
    timedOutCount: timedOut,
    cancelledCount: cancelled,
    avgResolutionTimeMs: resolvedWithTime > 0
      ? Math.round(totalResolutionTime / resolvedWithTime) : 0,
  };
}
