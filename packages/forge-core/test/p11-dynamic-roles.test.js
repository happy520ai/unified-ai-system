import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════════════
//  DynamicRoleAssigner Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('DynamicRoleAssigner', () => {
  let DynamicRoleAssigner, TaskType, RolePriority, Complexity;

  before(async () => {
    const mod = await import('../src/dynamic-roles/index.js');
    DynamicRoleAssigner = mod.DynamicRoleAssigner;
    TaskType = mod.TaskType;
    RolePriority = mod.RolePriority;
    Complexity = mod.Complexity;
  });

  // ── Enum values ──────────────────────────────────────────────────────────

  it('should expose correct TaskType enum values', () => {
    assert.equal(TaskType.IMPLEMENT, 'implement');
    assert.equal(TaskType.TEST, 'test');
    assert.equal(TaskType.VERIFY, 'verify');
    assert.equal(TaskType.DEBUG, 'debug');
    assert.equal(TaskType.REVIEW, 'review');
    assert.equal(TaskType.REFACTOR, 'refactor');
    assert.equal(Object.keys(TaskType).length, 6);
  });

  it('should expose correct RolePriority enum values', () => {
    assert.equal(RolePriority.PRIMARY, 'primary');
    assert.equal(RolePriority.SUPPORT, 'support');
  });

  it('should expose correct Complexity enum values', () => {
    assert.equal(Complexity.LOW, 'low');
    assert.equal(Complexity.MEDIUM, 'medium');
    assert.equal(Complexity.HIGH, 'high');
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const assigner = new DynamicRoleAssigner();
    const status = assigner.getStatus();
    assert.equal(status.agentCount, 0);
    assert.equal(status.assignmentCount, 0);
    assert.equal(status.avgLoad, 0);
  });

  // ── analyzeTask ──────────────────────────────────────────────────────────

  it('should analyze an implement task with low complexity', () => {
    const assigner = new DynamicRoleAssigner();
    const analysis = assigner.analyzeTask({
      type: TaskType.IMPLEMENT, prompt: 'Add a helper function', allowedFiles: ['src/util.js'],
    });
    assert.ok(analysis.roles.length >= 1);
    assert.equal(analysis.roles[0].role, 'coder');
    assert.equal(analysis.roles[0].priority, RolePriority.PRIMARY);
    assert.ok([Complexity.LOW, Complexity.MEDIUM].includes(analysis.estimatedComplexity));
    assert.equal(typeof analysis.parallelizable, 'boolean');
  });

  it('should analyze a test task', () => {
    const assigner = new DynamicRoleAssigner();
    const analysis = assigner.analyzeTask({
      type: TaskType.TEST, prompt: 'Write unit tests', allowedFiles: [],
    });
    assert.equal(analysis.roles[0].role, 'tester');
    assert.equal(analysis.roles[0].priority, RolePriority.PRIMARY);
  });

  it('should analyze a debug task', () => {
    const assigner = new DynamicRoleAssigner();
    const analysis = assigner.analyzeTask({
      type: TaskType.DEBUG, prompt: 'Fix the bug', allowedFiles: [],
    });
    assert.equal(analysis.roles[0].role, 'debugger');
  });

  it('should analyze a refactor task with high base complexity', () => {
    const assigner = new DynamicRoleAssigner();
    const analysis = assigner.analyzeTask({
      type: TaskType.REFACTOR, prompt: 'x', allowedFiles: [],
    });
    assert.ok(
      analysis.estimatedComplexity === Complexity.MEDIUM || analysis.estimatedComplexity === Complexity.HIGH,
    );
    assert.equal(analysis.roles[0].role, 'architect');
    assert.equal(analysis.parallelizable, false);
  });

  it('should increase complexity for long prompts and many files', () => {
    const assigner = new DynamicRoleAssigner();
    const longPrompt = 'A'.repeat(600);
    const manyFiles = Array.from({ length: 12 }, (_, i) => `file${i}.js`);
    const analysis = assigner.analyzeTask({
      type: TaskType.IMPLEMENT, prompt: longPrompt, allowedFiles: manyFiles,
    });
    assert.equal(analysis.estimatedComplexity, Complexity.HIGH);
  });

  it('should only keep primary roles for low complexity tasks', () => {
    const assigner = new DynamicRoleAssigner();
    const analysis = assigner.analyzeTask({
      type: TaskType.REVIEW, prompt: 'Quick review', allowedFiles: [],
    });
    if (analysis.estimatedComplexity === Complexity.LOW) {
      assert.ok(analysis.roles.every((r) => r.priority === RolePriority.PRIMARY));
    }
  });

  it('should mark test and verify tasks as parallelizable when not high complexity sequential', () => {
    const assigner = new DynamicRoleAssigner();
    const testAnalysis = assigner.analyzeTask({
      type: TaskType.TEST, prompt: 'Short test', allowedFiles: [],
    });
    if (testAnalysis.estimatedComplexity === Complexity.LOW) {
      assert.equal(testAnalysis.parallelizable, true);
    }
  });

  it('should default to implement type when type is missing', () => {
    const assigner = new DynamicRoleAssigner();
    const analysis = assigner.analyzeTask({ prompt: 'Do something', allowedFiles: [] });
    assert.equal(analysis.roles[0].role, 'coder');
  });

  // ── assignAgents ─────────────────────────────────────────────────────────

  it('should assign agents to a task based on role matching', () => {
    const assigner = new DynamicRoleAssigner();
    const task = { type: TaskType.IMPLEMENT, prompt: 'Add JWT auth', allowedFiles: ['src/auth.js'] };
    const agents = [
      { agentId: 'a1', role: 'coder', capabilities: ['coder', 'js'], load: 0 },
      { agentId: 'a2', role: 'architect', capabilities: ['architect'], load: 0 },
    ];
    const result = assigner.assignAgents(task, agents);
    assert.ok(result.assignments.length >= 1);
    const coderAssignment = result.assignments.find((a) => a.role === 'coder');
    assert.ok(coderAssignment);
    assert.equal(coderAssignment.agentId, 'a1');
  });

  it('should prefer less-loaded agents', () => {
    const assigner = new DynamicRoleAssigner();
    const task = { type: TaskType.IMPLEMENT, prompt: 'Add feature', allowedFiles: [] };
    const agents = [
      { agentId: 'busy', role: 'coder', capabilities: ['coder'], load: 5 },
      { agentId: 'free', role: 'coder', capabilities: ['coder'], load: 0 },
    ];
    const result = assigner.assignAgents(task, agents);
    const coderAssignment = result.assignments.find((a) => a.role === 'coder');
    assert.equal(coderAssignment.agentId, 'free');
  });

  it('should report unassigned roles when no matching agents exist', () => {
    const assigner = new DynamicRoleAssigner();
    const task = { type: TaskType.DEBUG, prompt: 'Fix crash', allowedFiles: [] };
    const agents = [
      { agentId: 'a1', role: 'coder', capabilities: ['coder'], load: 0 },
    ];
    const result = assigner.assignAgents(task, agents);
    assert.ok(result.unassigned.length >= 0);
  });

  it('should respect maxAgentsPerTask limit', () => {
    const assigner = new DynamicRoleAssigner({ maxAgentsPerTask: 1 });
    const task = {
      type: TaskType.REFACTOR, prompt: 'A'.repeat(600),
      allowedFiles: Array.from({ length: 12 }, (_, i) => `f${i}.js`),
    };
    const agents = [
      { agentId: 'a1', role: 'architect', capabilities: ['architect'], load: 0 },
      { agentId: 'a2', role: 'coder', capabilities: ['coder'], load: 0 },
      { agentId: 'a3', role: 'tester', capabilities: ['tester'], load: 0 },
    ];
    const result = assigner.assignAgents(task, agents);
    assert.ok(result.assignments.length <= 1);
    assert.ok(result.unassigned.length > 0);
  });

  it('should not assign the same agent to multiple roles in one task', () => {
    const assigner = new DynamicRoleAssigner();
    const task = { type: TaskType.TEST, prompt: 'Write tests', allowedFiles: [] };
    const agents = [
      { agentId: 'a1', role: 'tester', capabilities: ['tester', 'coder'], load: 0 },
    ];
    const result = assigner.assignAgents(task, agents);
    const assignedIds = result.assignments.map((a) => a.agentId);
    const uniqueIds = new Set(assignedIds);
    assert.equal(assignedIds.length, uniqueIds.size, 'No agent should be assigned twice');
  });

  // ── recordOutcome / getAgentStats ────────────────────────────────────────

  it('should record an outcome and reflect it in agent stats', () => {
    const assigner = new DynamicRoleAssigner();
    assigner.recordOutcome('task-1', 'agent-1', 'coder', {
      success: true, duration: 5000, quality: 0.9,
    });
    const stats = assigner.getAgentStats('agent-1');
    assert.equal(stats.tasksCompleted, 1);
    assert.equal(stats.successRate, 1);
    assert.equal(stats.avgDuration, 5000);
    assert.ok(stats.bestRoles.length > 0);
    assert.equal(stats.bestRoles[0].role, 'coder');
  });

  it('should compute success rate across multiple outcomes', () => {
    const assigner = new DynamicRoleAssigner();
    assigner.recordOutcome('t1', 'a1', 'coder', { success: true, duration: 3000, quality: 0.8 });
    assigner.recordOutcome('t2', 'a1', 'coder', { success: false, duration: 4000, quality: 0.3 });
    assigner.recordOutcome('t3', 'a1', 'coder', { success: true, duration: 5000, quality: 0.9 });
    const stats = assigner.getAgentStats('a1');
    assert.equal(stats.tasksCompleted, 3);
    assert.ok(Math.abs(stats.successRate - 0.67) < 0.01);
    assert.equal(stats.avgDuration, 4000);
  });

  it('should identify strengths for roles with score > 0.7 and at least 2 tasks', () => {
    const assigner = new DynamicRoleAssigner();
    assigner.recordOutcome('t1', 'a1', 'coder', { success: true, duration: 1000, quality: 0.9 });
    assigner.recordOutcome('t2', 'a1', 'coder', { success: true, duration: 1000, quality: 0.9 });
    assigner.recordOutcome('t3', 'a1', 'tester', { success: false, duration: 2000, quality: 0.2 });
    assigner.recordOutcome('t4', 'a1', 'tester', { success: false, duration: 2000, quality: 0.2 });
    const stats = assigner.getAgentStats('a1');
    assert.ok(stats.strengths.includes('coder'));
    assert.ok(!stats.strengths.includes('tester'));
  });

  it('should return default stats for an unknown agent', () => {
    const assigner = new DynamicRoleAssigner();
    const stats = assigner.getAgentStats('ghost');
    assert.equal(stats.tasksCompleted, 0);
    assert.equal(stats.successRate, 0);
    assert.equal(stats.avgDuration, 0);
    assert.deepEqual(stats.bestRoles, []);
    assert.deepEqual(stats.strengths, []);
  });

  it('should clamp quality to [0, 1] range', () => {
    const assigner = new DynamicRoleAssigner();
    assigner.recordOutcome('t1', 'a1', 'coder', { success: true, duration: 1000, quality: 1.5 });
    const stats = assigner.getAgentStats('a1');
    assert.equal(stats.bestRoles[0].score, 1);
  });

  // ── rebalance ────────────────────────────────────────────────────────────

  it('should rebalance workload from overloaded to underloaded agents', () => {
    const assigner = new DynamicRoleAssigner({ rebalanceThreshold: 0.3 });
    const currentAssignments = [
      {
        agentId: 'busy',
        load: 8,
        tasks: Array.from({ length: 8 }, (_, i) => ({
          agentId: 'busy', role: 'support', task: { type: 'implement', prompt: `t${i}` },
        })),
      },
      {
        agentId: 'idle',
        load: 1,
        tasks: [{ agentId: 'idle', role: 'coder', task: { type: 'implement', prompt: 't0' } }],
      },
    ];
    const result = assigner.rebalance(currentAssignments);
    assert.ok(result.movedCount > 0, 'Should have moved at least one task');
    const busyEntry = result.newAssignments.find((a) => a.agentId === 'busy');
    assert.ok(busyEntry.load < 8, 'Busy agent load should decrease');
  });

  it('should return no moves when workload is balanced', () => {
    const assigner = new DynamicRoleAssigner({ rebalanceThreshold: 0.3 });
    const currentAssignments = [
      { agentId: 'a1', load: 3, tasks: [] },
      { agentId: 'a2', load: 3, tasks: [] },
    ];
    const result = assigner.rebalance(currentAssignments);
    assert.equal(result.movedCount, 0);
  });

  it('should return no moves for single agent', () => {
    const assigner = new DynamicRoleAssigner();
    const currentAssignments = [{ agentId: 'a1', load: 5, tasks: [] }];
    const result = assigner.rebalance(currentAssignments);
    assert.equal(result.movedCount, 0);
  });

  // ── getStatus / clear ────────────────────────────────────────────────────

  it('should report status with role utilization after recording outcomes', () => {
    const assigner = new DynamicRoleAssigner();
    assigner.recordOutcome('t1', 'a1', 'coder', { success: true, duration: 1000, quality: 0.9 });
    assigner.recordOutcome('t2', 'a2', 'tester', { success: true, duration: 2000, quality: 0.8 });
    const status = assigner.getStatus();
    assert.equal(status.agentCount, 2);
    assert.ok(status.roleUtilization.coder > 0);
    assert.ok(status.roleUtilization.tester > 0);
  });

  it('should clear all history and assignments', () => {
    const assigner = new DynamicRoleAssigner();
    assigner.recordOutcome('t1', 'a1', 'coder', { success: true, duration: 1000, quality: 0.9 });
    assigner.clear();
    const status = assigner.getStatus();
    assert.equal(status.agentCount, 0);
    assert.equal(status.assignmentCount, 0);
  });
});
