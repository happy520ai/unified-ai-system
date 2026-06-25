import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════════════
//  AgentCommunication Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('AgentCommunication', () => {
  let AgentCommunication, FindingType, MessageType, AgentStatus;

  before(async () => {
    const mod = await import('../src/agent-communication/index.js');
    AgentCommunication = mod.AgentCommunication;
    FindingType = mod.FindingType;
    MessageType = mod.MessageType;
    AgentStatus = mod.AgentStatus;
  });

  // ── Enum values ──────────────────────────────────────────────────────────

  it('should expose correct FindingType enum values', () => {
    assert.equal(FindingType.DISCOVERY, 'discovery');
    assert.equal(FindingType.CONSTRAINT, 'constraint');
    assert.equal(FindingType.PATTERN, 'pattern');
    assert.equal(FindingType.RISK, 'risk');
    assert.equal(FindingType.DECISION, 'decision');
    assert.equal(Object.keys(FindingType).length, 5);
  });

  it('should expose correct MessageType enum values', () => {
    assert.equal(MessageType.REQUEST, 'request');
    assert.equal(MessageType.RESPONSE, 'response');
    assert.equal(MessageType.NOTIFICATION, 'notification');
    assert.equal(MessageType.QUERY, 'query');
    assert.equal(Object.keys(MessageType).length, 4);
  });

  it('should expose correct AgentStatus enum values', () => {
    assert.equal(AgentStatus.IDLE, 'idle');
    assert.equal(AgentStatus.WORKING, 'working');
    assert.equal(AgentStatus.DONE, 'done');
    assert.equal(Object.keys(AgentStatus).length, 3);
  });

  it('should have frozen enums that cannot be mutated', () => {
    assert.throws(() => { FindingType.NEW_TYPE = 'new'; }, TypeError);
    assert.throws(() => { MessageType.NEW_TYPE = 'new'; }, TypeError);
    assert.throws(() => { AgentStatus.NEW_TYPE = 'new'; }, TypeError);
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const comm = new AgentCommunication();
    const status = comm.getStatus();
    assert.equal(status.agentCount, 0);
    assert.equal(status.messageCount, 0);
    assert.equal(status.boardEntries, 0);
    assert.deepEqual(status.recentActivity, []);
  });

  it('should accept custom maxMessages option', () => {
    const comm = new AgentCommunication({ maxMessages: 5 });
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.registerAgent('a2', { role: 'tester', goalId: 'g1', capabilities: [], status: 'idle' });
    for (let i = 0; i < 7; i++) {
      comm.sendMessage('a1', 'a2', { type: 'notification', content: `msg ${i}` });
    }
    const msgs = comm.getMessages('a2', { limit: 100 });
    assert.equal(msgs.length, 5, 'Should retain only maxMessages messages');
  });

  it('should accept custom maxBoardEntries option', () => {
    const comm = new AgentCommunication({ maxBoardEntries: 3 });
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    for (let i = 0; i < 5; i++) {
      comm.postFinding('a1', {
        type: FindingType.DISCOVERY, content: `Finding ${i}`, confidence: 0.8,
        tags: ['tag'], relatedFiles: [], source: 'test',
      });
    }
    const status = comm.getStatus();
    assert.equal(status.boardEntries, 3, 'Should evict oldest entries beyond max');
  });

  // ── registerAgent / getRegisteredAgents ──────────────────────────────────

  it('should register an agent and retrieve it', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('agent-1', {
      role: 'coder', goalId: 'g1', capabilities: ['js', 'ts'], status: AgentStatus.WORKING,
    });
    const agents = comm.getRegisteredAgents();
    assert.equal(agents.length, 1);
    assert.equal(agents[0].agentId, 'agent-1');
    assert.equal(agents[0].metadata.role, 'coder');
    assert.deepEqual(agents[0].metadata.capabilities, ['js', 'ts']);
    assert.equal(agents[0].metadata.status, AgentStatus.WORKING);
  });

  it('should filter registered agents by goalId', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.registerAgent('a2', { role: 'tester', goalId: 'g2', capabilities: [], status: 'idle' });
    comm.registerAgent('a3', { role: 'architect', goalId: 'g1', capabilities: [], status: 'idle' });
    const g1Agents = comm.getRegisteredAgents('g1');
    assert.equal(g1Agents.length, 2);
    assert.ok(g1Agents.every((a) => a.metadata.goalId === 'g1'));
  });

  it('should return empty array when no agents match goalId', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    const result = comm.getRegisteredAgents('nonexistent');
    assert.deepEqual(result, []);
  });

  it('should emit agentRegistered event on registerAgent', () => {
    const comm = new AgentCommunication();
    let emitted = null;
    comm.on('agentRegistered', (data) => { emitted = data; });
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    assert.ok(emitted);
    assert.equal(emitted.agentId, 'a1');
  });

  it('should unregister an agent and return true', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    const removed = comm.unregisterAgent('a1');
    assert.equal(removed, true);
    assert.equal(comm.getRegisteredAgents().length, 0);
  });

  it('should return false when unregistering a non-existent agent', () => {
    const comm = new AgentCommunication();
    assert.equal(comm.unregisterAgent('nonexistent'), false);
  });

  it('should update agent status', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.updateAgentStatus('a1', AgentStatus.DONE);
    const agent = comm.getAgent('a1');
    assert.equal(agent.status, AgentStatus.DONE);
  });

  it('should return null for getAgent with unknown id', () => {
    const comm = new AgentCommunication();
    assert.equal(comm.getAgent('unknown'), null);
  });

  // ── postFinding / queryFindings ──────────────────────────────────────────

  it('should post a finding and return a findingId', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    const id = comm.postFinding('a1', {
      type: FindingType.DISCOVERY, content: 'Auth module uses JWT',
      confidence: 0.9, tags: ['auth', 'jwt'], relatedFiles: ['src/auth.js'], source: 'analysis',
    });
    assert.ok(id.startsWith('finding-'));
    assert.equal(comm.getStatus().boardEntries, 1);
  });

  it('should throw when posting a finding for an unregistered agent', () => {
    const comm = new AgentCommunication();
    assert.throws(
      () => comm.postFinding('ghost', {
        type: FindingType.DISCOVERY, content: 'test', confidence: 0.5,
        tags: [], relatedFiles: [], source: 'test',
      }),
      /not registered/i,
    );
  });

  it('should throw when posting a finding with invalid type', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    assert.throws(
      () => comm.postFinding('a1', {
        type: 'invalid_type', content: 'test', confidence: 0.5,
        tags: [], relatedFiles: [], source: 'test',
      }),
      /Invalid finding type/i,
    );
  });

  it('should clamp confidence to [0, 1] range', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    const id = comm.postFinding('a1', {
      type: FindingType.DISCOVERY, content: 'test', confidence: 1.5,
      tags: [], relatedFiles: [], source: 'test',
    });
    const entry = comm.getFinding(id);
    assert.equal(entry.finding.confidence, 1);
  });

  it('should query findings by keyword and return relevance scores', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.postFinding('a1', {
      type: FindingType.DISCOVERY, content: 'Auth module uses JWT tokens',
      confidence: 0.9, tags: ['auth', 'jwt'], relatedFiles: ['src/auth.js'], source: 'analysis',
    });
    comm.postFinding('a1', {
      type: FindingType.RISK, content: 'Database connection pool exhaustion',
      confidence: 0.7, tags: ['database', 'perf'], relatedFiles: ['src/db.js'], source: 'analysis',
    });
    const results = comm.queryFindings('auth jwt');
    assert.ok(results.length >= 1);
    assert.equal(results[0].finding.content, 'Auth module uses JWT tokens');
    assert.ok(results[0].relevance > 0);
  });

  it('should filter query results by type', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.postFinding('a1', {
      type: FindingType.DISCOVERY, content: 'Auth discovery', confidence: 0.9,
      tags: ['auth'], relatedFiles: [], source: 'test',
    });
    comm.postFinding('a1', {
      type: FindingType.RISK, content: 'Auth risk', confidence: 0.9,
      tags: ['auth'], relatedFiles: [], source: 'test',
    });
    const results = comm.queryFindings('auth', { types: [FindingType.RISK] });
    assert.equal(results.length, 1);
    assert.equal(results[0].finding.type, FindingType.RISK);
  });

  it('should filter query results by tags', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.postFinding('a1', {
      type: FindingType.DISCOVERY, content: 'A', confidence: 0.9,
      tags: ['alpha'], relatedFiles: [], source: 'test',
    });
    comm.postFinding('a1', {
      type: FindingType.DISCOVERY, content: 'B', confidence: 0.9,
      tags: ['beta'], relatedFiles: [], source: 'test',
    });
    const results = comm.queryFindings('', { tags: ['alpha'] });
    assert.equal(results.length, 1);
    assert.equal(results[0].finding.content, 'A');
  });

  it('should filter query results by minConfidence', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.postFinding('a1', {
      type: FindingType.DISCOVERY, content: 'High conf', confidence: 0.9,
      tags: [], relatedFiles: [], source: 'test',
    });
    comm.postFinding('a1', {
      type: FindingType.DISCOVERY, content: 'Low conf', confidence: 0.2,
      tags: [], relatedFiles: [], source: 'test',
    });
    const results = comm.queryFindings('', { minConfidence: 0.5 });
    assert.equal(results.length, 1);
    assert.equal(results[0].finding.content, 'High conf');
  });

  it('should filter query results by relatedTo file', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.postFinding('a1', {
      type: FindingType.DISCOVERY, content: 'Auth finding', confidence: 0.9,
      tags: [], relatedFiles: ['src/auth.js'], source: 'test',
    });
    comm.postFinding('a1', {
      type: FindingType.DISCOVERY, content: 'DB finding', confidence: 0.9,
      tags: [], relatedFiles: ['src/db.js'], source: 'test',
    });
    const results = comm.queryFindings('', { relatedTo: 'src/auth.js' });
    assert.equal(results.length, 1);
    assert.equal(results[0].finding.content, 'Auth finding');
  });

  it('should return empty array when no findings match query', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    const results = comm.queryFindings('nonexistent topic');
    assert.deepEqual(results, []);
  });

  it('should remove a finding from the blackboard', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    const id = comm.postFinding('a1', {
      type: FindingType.DISCOVERY, content: 'temp', confidence: 0.5,
      tags: [], relatedFiles: [], source: 'test',
    });
    assert.equal(comm.removeFinding('a1', id), true);
    assert.equal(comm.getFinding(id), null);
  });

  it('should return false when removing a nonexistent finding', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    assert.equal(comm.removeFinding('a1', 'nonexistent'), false);
  });

  // ── sendMessage / getMessages / broadcast ────────────────────────────────

  it('should send a message and retrieve it', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.registerAgent('a2', { role: 'tester', goalId: 'g1', capabilities: [], status: 'idle' });
    const msgId = comm.sendMessage('a1', 'a2', {
      type: MessageType.REQUEST, content: 'Write tests for auth', data: { files: ['auth.js'] },
    });
    assert.ok(msgId.startsWith('msg-'));
    const msgs = comm.getMessages('a2');
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].from, 'a1');
    assert.equal(msgs[0].message.type, MessageType.REQUEST);
    assert.equal(msgs[0].message.content, 'Write tests for auth');
    assert.deepEqual(msgs[0].message.data, { files: ['auth.js'] });
  });

  it('should throw when sending from an unregistered agent', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a2', { role: 'tester', goalId: 'g1', capabilities: [], status: 'idle' });
    assert.throws(
      () => comm.sendMessage('ghost', 'a2', { type: MessageType.REQUEST, content: 'hi' }),
      /not registered/i,
    );
  });

  it('should throw when sending a message with invalid type', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.registerAgent('a2', { role: 'tester', goalId: 'g1', capabilities: [], status: 'idle' });
    assert.throws(
      () => comm.sendMessage('a1', 'a2', { type: 'bad_type', content: 'hi' }),
      /Invalid message type/i,
    );
  });

  it('should return empty array for agent with no messages', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    assert.deepEqual(comm.getMessages('a1'), []);
  });

  it('should return empty array for unknown agent getMessages', () => {
    const comm = new AgentCommunication();
    assert.deepEqual(comm.getMessages('unknown'), []);
  });

  it('should filter messages by type', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.registerAgent('a2', { role: 'tester', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.sendMessage('a1', 'a2', { type: MessageType.REQUEST, content: 'req' });
    comm.sendMessage('a1', 'a2', { type: MessageType.NOTIFICATION, content: 'notif' });
    const msgs = comm.getMessages('a2', { types: [MessageType.NOTIFICATION] });
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].message.content, 'notif');
  });

  it('should mark messages as read on getMessages by default', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.registerAgent('a2', { role: 'tester', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.sendMessage('a1', 'a2', { type: MessageType.REQUEST, content: 'hi' });
    assert.equal(comm.getUnreadCount('a2'), 1);
    comm.getMessages('a2');
    assert.equal(comm.getUnreadCount('a2'), 0);
  });

  it('should not mark read when markRead=false', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.registerAgent('a2', { role: 'tester', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.sendMessage('a1', 'a2', { type: MessageType.REQUEST, content: 'hi' });
    comm.getMessages('a2', { markRead: false });
    assert.equal(comm.getUnreadCount('a2'), 1);
  });

  it('should broadcast to all agents except the sender', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.registerAgent('a2', { role: 'tester', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.registerAgent('a3', { role: 'arch', goalId: 'g1', capabilities: [], status: 'idle' });
    const ids = comm.broadcast('a1', { type: MessageType.NOTIFICATION, content: 'hello all' });
    assert.equal(ids.length, 2);
    assert.equal(comm.getMessages('a2').length, 1);
    assert.equal(comm.getMessages('a3').length, 1);
    assert.equal(comm.getMessages('a1').length, 0);
  });

  it('should emit message event on sendMessage', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.registerAgent('a2', { role: 'tester', goalId: 'g1', capabilities: [], status: 'idle' });
    let emitted = null;
    comm.on('message', (data) => { emitted = data; });
    comm.sendMessage('a1', 'a2', { type: MessageType.REQUEST, content: 'test' });
    assert.ok(emitted);
    assert.equal(emitted.from, 'a1');
    assert.equal(emitted.to, 'a2');
  });

  it('should mark a specific message as read', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.registerAgent('a2', { role: 'tester', goalId: 'g1', capabilities: [], status: 'idle' });
    const msgId = comm.sendMessage('a1', 'a2', { type: MessageType.REQUEST, content: 'hi' });
    assert.equal(comm.markRead('a2', msgId), true);
    assert.equal(comm.getUnreadCount('a2'), 0);
  });

  it('should return false for markRead on nonexistent message', () => {
    const comm = new AgentCommunication();
    assert.equal(comm.markRead('unknown', 'no-msg'), false);
  });

  // ── Communication graph / clear / status ─────────────────────────────────

  it('should build a communication graph for a goal', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.registerAgent('a2', { role: 'tester', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.sendMessage('a1', 'a2', { type: MessageType.REQUEST, content: 'test1' });
    comm.sendMessage('a1', 'a2', { type: MessageType.REQUEST, content: 'test2' });
    const graph = comm.getCommunicationGraph('g1');
    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.edges[0].from, 'a1');
    assert.equal(graph.edges[0].to, 'a2');
    assert.equal(graph.edges[0].count, 2);
  });

  it('should clear all state', () => {
    const comm = new AgentCommunication();
    comm.registerAgent('a1', { role: 'coder', goalId: 'g1', capabilities: [], status: 'idle' });
    comm.postFinding('a1', {
      type: FindingType.DISCOVERY, content: 'test', confidence: 0.5,
      tags: [], relatedFiles: [], source: 'test',
    });
    comm.clear();
    const status = comm.getStatus();
    assert.equal(status.agentCount, 0);
    assert.equal(status.messageCount, 0);
    assert.equal(status.boardEntries, 0);
  });
});
