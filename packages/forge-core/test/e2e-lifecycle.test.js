/**
 * E2E Full Lifecycle Test - Test 12
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { MemoryEngine, MemoryType } from '../src/memory-engine/index.js';
import { BashSafety, SafetyVerdict } from '../src/bash-safety/index.js';
import { KnowledgeGraph } from '../src/knowledge-graph/index.js';
import { ErrorPatternLearner } from '../src/error-pattern-learner/index.js';
import { CostAttribution } from '../src/cost-attribution/index.js';
import { DecisionTrace } from '../src/decision-trace/index.js';
import { HealthDashboard } from '../src/health-dashboard/index.js';
import { MultiAgentReview } from '../src/multi-agent-review/index.js';
import { PromptInjectionDefense } from '../src/injection-defense/index.js';
import { SemanticMemory } from '../src/semantic-memory/index.js';
import { mockCallLLM, TempProject } from './e2e-fixtures.js';

describe('E2E Full Lifecycle', () => {
  const project = new TempProject();
  let projectDir;

  before(async () => {
    projectDir = await project.setup();
  });

  after(async () => {
    await project.teardown();
  });

  it('Full goal lifecycle: submit -> execute -> verify -> complete', async () => {
    const memory = new MemoryEngine();
    const graph = new KnowledgeGraph();
    const safety = new BashSafety();
    const learner = new ErrorPatternLearner({ minOccurrences: 2 });
    const costTracker = new CostAttribution();
    const trace = new DecisionTrace();
    const dashboard = new HealthDashboard();
    const reviewer = new MultiAgentReview({ severityThreshold: 'error' });
    const defense = new PromptInjectionDefense({ level: 'standard' });
    const semantic = new SemanticMemory({ dimensions: 128 });

    const goalId = 'goal-lifecycle-001';

    dashboard.registerModule('memory', () => ({
      status: 'healthy',
      details: { entries: memory.getStatus().hot.entries },
    }));
    dashboard.registerModule('knowledge-graph', () => ({
      status: 'healthy',
      details: { files: graph.getStatus().files },
    }));
    dashboard.registerModule('cost', () => ({
      status: 'healthy',
      details: { totalCost: costTracker.getTotalCost().totalCost },
    }));
    dashboard.registerModule('safety', () => ({
      status: 'healthy',
      details: safety.getStatus(),
    }));

    // Phase 1: Submit goal
    trace.record({
      goalId,
      taskId: 'init',
      workerType: 'orchestrator',
      decision: 'strategy_selection',
      action: { strategy: 'implement-and-test' },
      reasoning: 'Goal requires implementing a new feature with tests',
      outcome: 'success',
      confidence: 90,
    });

    memory.remember(`Goal submitted: ${goalId} - implement greet module`, {
      type: MemoryType.DECISION,
      tags: ['goal', goalId],
      importance: 95,
    });

    // Phase 2: Execute
    const indexContent = await readFile(join(projectDir, 'src', 'index.js'), 'utf-8');
    const utilsContent = await readFile(join(projectDir, 'src', 'utils.js'), 'utf-8');

    const indexScan = defense.scanFile('src/index.js', indexContent);
    const utilsScan = defense.scanFile('src/utils.js', utilsContent);
    assert.strictEqual(indexScan.clean, true, 'index.js should be clean');
    assert.strictEqual(utilsScan.clean, true, 'utils.js should be clean');

    graph.addFile('src/index.js', indexContent);
    graph.addFile('src/utils.js', utilsContent);

    semantic.index('src/index.js', indexContent, { type: 'source' });
    semantic.index('src/utils.js', utilsContent, { type: 'source' });

    const llmResult = mockCallLLM('implement a greet module');
    assert.ok(llmResult.actions.length > 0, 'Mock LLM should return actions');

    const generatedAction = llmResult.actions[0];
    const generatedPath = join(projectDir, generatedAction.path);
    await mkdir(join(projectDir, 'src'), { recursive: true });
    await writeFile(generatedPath, generatedAction.content, 'utf-8');

    graph.addFile(generatedAction.path, generatedAction.content);
    semantic.index(generatedAction.path, generatedAction.content, { type: 'generated' });

    memory.remember(`Generated ${generatedAction.path}: ${llmResult.summary}`, {
      type: MemoryType.ACTION,
      tags: ['write', 'code-gen', goalId],
      importance: 80,
    });

    costTracker.record({
      goalId,
      taskId: 'task-implement',
      workerType: 'coder',
      model: 'mimo-v2.5-pro',
      inputTokens: 4000,
      outputTokens: 1500,
      cost: 0.0021,
      duration: 1500,
    });

    trace.record({
      goalId,
      taskId: 'task-implement',
      workerType: 'coder',
      decision: 'file_modification',
      action: { tool: 'write', path: generatedAction.path },
      reasoning: 'Creating the new greet module as requested',
      outcome: 'success',
      confidence: 85,
    });

    // Phase 3: Verify
    const reviewResult = reviewer.review([
      {
        path: generatedAction.path,
        original: '',
        modified: generatedAction.content,
        action: 'write',
      },
    ]);

    costTracker.record({
      goalId,
      taskId: 'task-review',
      workerType: 'reviewer',
      model: 'mimo-v2.5-pro',
      inputTokens: 3000,
      outputTokens: 500,
      cost: 0.0012,
      duration: 800,
    });

    trace.record({
      goalId,
      taskId: 'task-review',
      workerType: 'reviewer',
      decision: 'strategy_selection',
      action: { passed: reviewResult.passed, issues: reviewResult.stats.total },
      reasoning: reviewResult.summary,
      outcome: reviewResult.passed ? 'success' : 'failure',
      confidence: reviewResult.passed ? 95 : 40,
    });

    const testCmd = safety.check('npm test');
    assert.strictEqual(testCmd.verdict, SafetyVerdict.ALLOWED, 'npm test should be safe');

    const relatedFiles = semantic.search('greet function', { limit: 3 });
    assert.ok(relatedFiles.length > 0, 'Semantic search should find related files');

    // Phase 4: Complete
    memory.remember(`Goal ${goalId} completed successfully. ${reviewResult.summary}`, {
      type: MemoryType.SUMMARY,
      tags: ['goal-complete', goalId],
      importance: 95,
    });

    trace.record({
      goalId,
      taskId: 'complete',
      workerType: 'orchestrator',
      decision: 'strategy_selection',
      action: { status: 'complete', reviewPassed: reviewResult.passed },
      reasoning: 'All tasks completed, goal is done',
      outcome: 'success',
      confidence: 100,
    });

    const finalSnapshot = await dashboard.refresh();
    assert.strictEqual(
      finalSnapshot.status,
      'healthy',
      'System should be healthy after successful goal completion',
    );

    // Verify end-to-end integration
    const goalMemories = memory.search(goalId, { limit: 20 });
    assert.ok(goalMemories.length >= 3, 'Should have at least 3 memories for this goal');

    const graphStatus = graph.getStatus();
    assert.ok(graphStatus.files >= 3, 'Graph should have at least 3 files');

    const goalCost = costTracker.getGoalCost(goalId);
    assert.strictEqual(goalCost.tasks, 2, 'Goal should have 2 cost records (implement + review)');
    assert.ok(goalCost.totalCost > 0, 'Total cost should be positive');

    const goalDecisions = trace.getGoalDecisions(goalId);
    assert.ok(goalDecisions.length >= 4, 'Should have at least 4 decisions for the goal');

    const learnerStatus = learner.getStatus();
    assert.ok(learnerStatus.errors >= 0, 'Learner should be in a valid state');

    const semanticStats = semantic.getStats();
    assert.ok(semanticStats.documents >= 3, 'Semantic memory should have at least 3 documents');

    const uptimeStats = dashboard.getUptime();
    assert.strictEqual(uptimeStats.checksPerformed, 1);
    assert.strictEqual(uptimeStats.healthyChecks, 1);
  });
});
