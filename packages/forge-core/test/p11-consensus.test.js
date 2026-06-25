import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════════════
//  ConsensusEngine Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('ConsensusEngine', () => {
  let ConsensusEngine, ConsensusStrategy, ProposalUrgency, RoundStatus;

  before(async () => {
    const mod = await import('../src/consensus/index.js');
    ConsensusEngine = mod.ConsensusEngine;
    ConsensusStrategy = mod.ConsensusStrategy;
    ProposalUrgency = mod.ProposalUrgency;
    RoundStatus = mod.RoundStatus;
  });

  // ── Enum values ──────────────────────────────────────────────────────────

  it('should expose correct ConsensusStrategy enum values', () => {
    assert.equal(ConsensusStrategy.MAJORITY, 'majority');
    assert.equal(ConsensusStrategy.WEIGHTED, 'weighted');
    assert.equal(ConsensusStrategy.UNANIMOUS, 'unanimous');
    assert.equal(ConsensusStrategy.EXPERT, 'expert');
  });

  it('should expose correct ProposalUrgency enum values', () => {
    assert.equal(ProposalUrgency.LOW, 'low');
    assert.equal(ProposalUrgency.MEDIUM, 'medium');
    assert.equal(ProposalUrgency.HIGH, 'high');
  });

  it('should expose correct RoundStatus enum values', () => {
    assert.equal(RoundStatus.ACTIVE, 'active');
    assert.equal(RoundStatus.RESOLVED, 'resolved');
    assert.equal(RoundStatus.TIMED_OUT, 'timed_out');
    assert.equal(RoundStatus.CANCELLED, 'cancelled');
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const engine = new ConsensusEngine();
    const status = engine.getStatus();
    assert.equal(status.activeRounds, 0);
    assert.equal(status.resolvedCount, 0);
    assert.equal(status.timedOutCount, 0);
    assert.equal(status.cancelledCount, 0);
    assert.equal(status.avgResolutionTimeMs, 0);
  });

  // ── propose ──────────────────────────────────────────────────────────────

  it('should create a round via propose and return a roundId', async () => {
    const engine = new ConsensusEngine();
    const roundId = await engine.propose('agent-1', {
      topic: 'Database choice', options: ['PostgreSQL', 'SQLite'],
      urgency: ProposalUrgency.MEDIUM,
    });
    assert.ok(roundId.startsWith('round-'));
    assert.equal(engine.getActiveRounds().length, 1);
  });

  it('should throw when proposing without a topic', async () => {
    const engine = new ConsensusEngine();
    await assert.rejects(
      () => engine.propose('a1', { topic: '', options: ['a', 'b'], urgency: 'medium' }),
      /topic/i,
    );
  });

  it('should throw when proposing with fewer than 2 options', async () => {
    const engine = new ConsensusEngine();
    await assert.rejects(
      () => engine.propose('a1', { topic: 'T', options: ['only-one'], urgency: 'medium' }),
      /at least two/i,
    );
  });

  it('should throw when proposing with invalid urgency', async () => {
    const engine = new ConsensusEngine();
    await assert.rejects(
      () => engine.propose('a1', { topic: 'T', options: ['a', 'b'], urgency: 'extreme' }),
      /Invalid urgency/i,
    );
  });

  // ── vote ─────────────────────────────────────────────────────────────────

  it('should accept votes and return accepted=true with current tally', async () => {
    const engine = new ConsensusEngine({ minVoters: 2 });
    const roundId = await engine.propose('a1', {
      topic: 'DB', options: ['PG', 'SQLite'], urgency: 'medium',
    });
    engine.addVoter(roundId, 'a2');
    engine.addVoter(roundId, 'a3');
    const result = engine.vote(roundId, 'a2', {
      option: 'PG', confidence: 0.9, reasoning: 'Best fit',
    });
    assert.equal(result.accepted, true);
    assert.equal(result.currentTally.votedCount, 1);
    assert.equal(result.currentTally.leadingOption, 'PG');
  });

  it('should throw when voting for an invalid option', async () => {
    const engine = new ConsensusEngine();
    const roundId = await engine.propose('a1', {
      topic: 'DB', options: ['PG', 'SQLite'], urgency: 'medium',
    });
    assert.throws(
      () => engine.vote(roundId, 'a2', { option: 'MySQL', confidence: 0.8, reasoning: 'x' }),
      /Invalid option/i,
    );
  });

  it('should throw when voting on a nonexistent round', () => {
    const engine = new ConsensusEngine();
    assert.throws(
      () => engine.vote('fake-round', 'a1', { option: 'x', confidence: 0.5, reasoning: '' }),
      /not found/i,
    );
  });

  it('should reject votes on a resolved round', async () => {
    const engine = new ConsensusEngine({ minVoters: 1 });
    const roundId = await engine.propose('a1', {
      topic: 'T', options: ['A', 'B'], urgency: 'medium',
    });
    engine.addVoter(roundId, 'a2');
    engine.vote(roundId, 'a2', { option: 'A', confidence: 0.9, reasoning: '' });
    engine.resolve(roundId, 'majority');
    const result = engine.vote(roundId, 'a3', { option: 'B', confidence: 0.5, reasoning: '' });
    assert.equal(result.accepted, false);
  });

  it('should update vote if same voter votes again', async () => {
    const engine = new ConsensusEngine({ minVoters: 1 });
    const roundId = await engine.propose('a1', {
      topic: 'T', options: ['A', 'B'], urgency: 'medium',
    });
    engine.addVoter(roundId, 'a2');
    engine.vote(roundId, 'a2', { option: 'A', confidence: 0.5, reasoning: 'first' });
    engine.vote(roundId, 'a2', { option: 'B', confidence: 0.9, reasoning: 'changed mind' });
    const tally = engine.getTally(roundId);
    assert.equal(tally.votedCount, 1);
    assert.equal(tally.votes['B'].length, 1);
    assert.equal(tally.votes['A'].length, 0);
  });

  // ── getTally ─────────────────────────────────────────────────────────────

  it('should return a default tally for nonexistent round', () => {
    const engine = new ConsensusEngine();
    const tally = engine.getTally('nonexistent');
    assert.equal(tally.votedCount, 0);
    assert.equal(tally.quorumMet, false);
    assert.equal(tally.leadingOption, null);
  });

  it('should track quorum correctly', async () => {
    const engine = new ConsensusEngine({ minVoters: 3, quorumRatio: 0.6 });
    const roundId = await engine.propose('a1', {
      topic: 'T', options: ['A', 'B'], urgency: 'medium',
    });
    engine.addVoters(roundId, ['v1', 'v2', 'v3', 'v4', 'v5']);
    engine.vote(roundId, 'v1', { option: 'A', confidence: 0.9, reasoning: '' });
    engine.vote(roundId, 'v2', { option: 'A', confidence: 0.8, reasoning: '' });
    let tally = engine.getTally(roundId);
    assert.equal(tally.quorumMet, false, '2 of 5 with minVoters=3 should not meet quorum');

    engine.vote(roundId, 'v3', { option: 'A', confidence: 0.7, reasoning: '' });
    tally = engine.getTally(roundId);
    assert.equal(tally.quorumMet, true, '3 of 5 with minVoters=3 should meet quorum');
  });

  // ── resolve with majority strategy ───────────────────────────────────────

  it('should resolve with majority strategy', async () => {
    const engine = new ConsensusEngine({ minVoters: 1 });
    const roundId = await engine.propose('a1', {
      topic: 'DB', options: ['PG', 'SQLite', 'Mongo'], urgency: 'medium',
    });
    engine.addVoters(roundId, ['v1', 'v2', 'v3']);
    engine.vote(roundId, 'v1', { option: 'PG', confidence: 0.9, reasoning: 'Relational' });
    engine.vote(roundId, 'v2', { option: 'PG', confidence: 0.8, reasoning: 'Mature' });
    engine.vote(roundId, 'v3', { option: 'SQLite', confidence: 0.7, reasoning: 'Simple' });
    const result = engine.resolve(roundId, ConsensusStrategy.MAJORITY);
    assert.equal(result.resolved, true);
    assert.equal(result.winner, 'PG');
    assert.equal(result.strategy, ConsensusStrategy.MAJORITY);
    assert.ok(result.confidence > 0);
    assert.ok(result.reasoning.length > 0);
  });

  // ── resolve with weighted strategy ─────────────────────────────────────

  it('should resolve with weighted strategy favoring higher confidence', async () => {
    const engine = new ConsensusEngine({ minVoters: 1 });
    const roundId = await engine.propose('a1', {
      topic: 'T', options: ['A', 'B'], urgency: 'medium',
    });
    engine.addVoters(roundId, ['v1', 'v2', 'v3']);
    engine.vote(roundId, 'v1', { option: 'A', confidence: 0.3, reasoning: '' });
    engine.vote(roundId, 'v2', { option: 'A', confidence: 0.3, reasoning: '' });
    engine.vote(roundId, 'v3', { option: 'B', confidence: 0.95, reasoning: 'Expert' });
    const result = engine.resolve(roundId, ConsensusStrategy.WEIGHTED);
    assert.equal(result.resolved, true);
    assert.equal(result.winner, 'B');
    assert.equal(result.strategy, ConsensusStrategy.WEIGHTED);
  });

  // ── resolve with unanimous strategy ─────────────────────────────────────

  it('should resolve unanimously when all agree', async () => {
    const engine = new ConsensusEngine({ minVoters: 1 });
    const roundId = await engine.propose('a1', {
      topic: 'T', options: ['A', 'B'], urgency: 'medium',
    });
    engine.addVoters(roundId, ['v1', 'v2']);
    engine.vote(roundId, 'v1', { option: 'A', confidence: 0.9, reasoning: '' });
    engine.vote(roundId, 'v2', { option: 'A', confidence: 0.8, reasoning: '' });
    const result = engine.resolve(roundId, ConsensusStrategy.UNANIMOUS);
    assert.equal(result.resolved, true);
    assert.equal(result.winner, 'A');
  });

  it('should fail unanimous resolution when voters disagree', async () => {
    const engine = new ConsensusEngine({ minVoters: 1 });
    const roundId = await engine.propose('a1', {
      topic: 'T', options: ['A', 'B'], urgency: 'medium',
    });
    engine.addVoters(roundId, ['v1', 'v2']);
    engine.vote(roundId, 'v1', { option: 'A', confidence: 0.9, reasoning: 'A is better' });
    engine.vote(roundId, 'v2', { option: 'B', confidence: 0.8, reasoning: 'B is better' });
    const result = engine.resolve(roundId, ConsensusStrategy.UNANIMOUS);
    assert.equal(result.resolved, false);
    assert.equal(result.winner, null);
  });

  // ── resolve with expert strategy ────────────────────────────────────────

  it('should resolve with expert strategy picking highest confidence vote', async () => {
    const engine = new ConsensusEngine({ minVoters: 1 });
    const roundId = await engine.propose('a1', {
      topic: 'T', options: ['A', 'B'], urgency: 'medium',
    });
    engine.addVoters(roundId, ['v1', 'v2', 'v3']);
    engine.vote(roundId, 'v1', { option: 'A', confidence: 0.4, reasoning: 'guess' });
    engine.vote(roundId, 'v2', { option: 'B', confidence: 0.95, reasoning: 'expert analysis' });
    engine.vote(roundId, 'v3', { option: 'A', confidence: 0.6, reasoning: 'ok' });
    const result = engine.resolve(roundId, ConsensusStrategy.EXPERT);
    assert.equal(result.resolved, true);
    assert.equal(result.winner, 'B');
    assert.equal(result.confidence, 0.95);
    assert.ok(result.reasoning[0].includes('v2'));
  });

  // ── resolve with no votes ───────────────────────────────────────────────

  it('should return unresolved when no votes are cast', async () => {
    const engine = new ConsensusEngine();
    const roundId = await engine.propose('a1', {
      topic: 'T', options: ['A', 'B'], urgency: 'medium',
    });
    const result = engine.resolve(roundId, 'majority');
    assert.equal(result.resolved, false);
    assert.equal(result.winner, null);
  });

  // ── autoResolve ─────────────────────────────────────────────────────────

  it('should autoResolve with full resolution when quorum is met', async () => {
    const engine = new ConsensusEngine({ minVoters: 2 });
    const roundId = await engine.propose('a1', {
      topic: 'T', options: ['A', 'B'], urgency: 'medium',
    });
    engine.addVoters(roundId, ['v1', 'v2']);
    engine.vote(roundId, 'v1', { option: 'A', confidence: 0.9, reasoning: '' });
    engine.vote(roundId, 'v2', { option: 'A', confidence: 0.8, reasoning: '' });
    const result = engine.autoResolve(roundId, 'majority');
    assert.equal(result.resolved, true);
    assert.equal(result.winner, 'A');
  });

  it('should autoResolve with partial results when quorum is not met', async () => {
    const engine = new ConsensusEngine({ minVoters: 5 });
    const roundId = await engine.propose('a1', {
      topic: 'T', options: ['A', 'B'], urgency: 'medium',
    });
    engine.addVoters(roundId, ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10']);
    engine.vote(roundId, 'v1', { option: 'A', confidence: 0.9, reasoning: '' });
    const result = engine.autoResolve(roundId, 'majority');
    assert.equal(result.resolved, false);
    assert.equal(result.winner, null);
    const round = engine.getRound(roundId);
    assert.equal(round.status, RoundStatus.TIMED_OUT);
  });

  // ── cancel ──────────────────────────────────────────────────────────────

  it('should cancel an active round', async () => {
    const engine = new ConsensusEngine();
    const roundId = await engine.propose('a1', {
      topic: 'T', options: ['A', 'B'], urgency: 'medium',
    });
    const cancelled = engine.cancel(roundId, 'No longer needed');
    assert.equal(cancelled, true);
    const round = engine.getRound(roundId);
    assert.equal(round.status, RoundStatus.CANCELLED);
  });

  it('should return false when cancelling a nonexistent round', () => {
    const engine = new ConsensusEngine();
    assert.equal(engine.cancel('nonexistent'), false);
  });

  // ── history ─────────────────────────────────────────────────────────────

  it('should record resolved rounds in history', async () => {
    const engine = new ConsensusEngine({ minVoters: 1 });
    const roundId = await engine.propose('a1', {
      topic: 'DB choice', options: ['PG', 'SQLite'], urgency: 'medium',
    });
    engine.addVoter(roundId, 'v1');
    engine.vote(roundId, 'v1', { option: 'PG', confidence: 0.9, reasoning: '' });
    engine.resolve(roundId, 'majority');
    const history = engine.getHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].topic, 'DB choice');
    assert.equal(history[0].winner, 'PG');
    assert.equal(history[0].status, RoundStatus.RESOLVED);
  });

  // ── clear ───────────────────────────────────────────────────────────────

  it('should clear all rounds and history', async () => {
    const engine = new ConsensusEngine({ minVoters: 1 });
    const roundId = await engine.propose('a1', {
      topic: 'T', options: ['A', 'B'], urgency: 'medium',
    });
    engine.addVoter(roundId, 'v1');
    engine.vote(roundId, 'v1', { option: 'A', confidence: 0.9, reasoning: '' });
    engine.resolve(roundId, 'majority');
    engine.clear();
    assert.equal(engine.getActiveRounds().length, 0);
    assert.equal(engine.getHistory().length, 0);
    assert.deepEqual(engine.getStatus(), {
      activeRounds: 0, resolvedCount: 0, timedOutCount: 0, cancelledCount: 0, avgResolutionTimeMs: 0,
    });
  });
});
