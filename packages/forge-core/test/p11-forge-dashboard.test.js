/**
 * P11 ForgeDashboard Test Suite - Core Functionality
 *
 * Tests for:
 *   - ForgeDashboard construction, generateDashboard, getStatus, collectData, edge cases
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ForgeDashboard } from '../src/forge-dashboard/index.js';

describe('ForgeDashboard', () => {
  describe('construction', () => {
    it('should create an instance with default options', () => {
      const dash = new ForgeDashboard();
      assert.ok(dash instanceof ForgeDashboard);
    });

    it('should accept custom port and host', () => {
      const dash = new ForgeDashboard({ port: 9999, host: '0.0.0.0' });
      const status = dash.getStatus();
      assert.equal(status.port, 9999);
    });

    it('should accept custom refreshIntervalMs', () => {
      const dash = new ForgeDashboard({ refreshIntervalMs: 5000 });
      assert.ok(dash instanceof ForgeDashboard);
    });

    it('should accept auth configuration', () => {
      const dash = new ForgeDashboard({ auth: { user: 'admin', pass: 'secret' } });
      assert.ok(dash instanceof ForgeDashboard);
    });

    it('should report not-running status before start', () => {
      const dash = new ForgeDashboard();
      const status = dash.getStatus();
      assert.equal(status.running, false);
      assert.equal(status.url, null);
      assert.equal(status.connections, 0);
    });
  });

  describe('generateDashboard()', () => {
    it('should return a string containing <!DOCTYPE html>', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard({});
      assert.ok(html.startsWith('<!DOCTYPE html>'));
    });

    it('should contain dark theme CSS variables', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard({});
      assert.ok(html.includes('--bg-primary: #1a1a2e'));
      assert.ok(html.includes('--bg-card: #16213e'));
      assert.ok(html.includes('--accent: #0f3460'));
    });

    it('should contain CSS grid layout', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard({});
      assert.ok(html.includes('display: grid'));
      assert.ok(html.includes('grid-template-columns'));
    });

    it('should contain the dashboard title "Forge Dashboard"', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard({});
      assert.ok(html.includes('Forge Dashboard'));
    });

    it('should contain connection status indicator elements', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard({});
      assert.ok(html.includes('conn-dot'));
      assert.ok(html.includes('conn-label'));
      assert.ok(html.includes('status-dot'));
    });

    it('should contain all dashboard section headers', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard({});
      assert.ok(html.includes('Goals Overview'));
      assert.ok(html.includes('Active Goal'));
      assert.ok(html.includes('Agent Pool'));
      assert.ok(html.includes('Performance'));
      assert.ok(html.includes('Cost'));
      assert.ok(html.includes('System Health'));
      assert.ok(html.includes('Activity Log'));
    });

    it('should embed JavaScript for auto-refresh polling', () => {
      const dash = new ForgeDashboard({ refreshIntervalMs: 3000 });
      const html = dash.generateDashboard({});
      assert.ok(html.includes('<script>'));
      assert.ok(html.includes('3000'));
      assert.ok(html.includes('/api/status'));
    });

    it('should render goal data when goals are provided', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard({
        goals: [
          { id: 'g1', text: 'Build login page', status: 'running', created_at: new Date().toISOString() },
          { id: 'g2', text: 'Fix nav bug', status: 'completed', created_at: new Date().toISOString() },
        ],
      });
      assert.ok(html.includes('Build login page'));
      assert.ok(html.includes('Fix nav bug'));
    });

    it('should show empty-state message when no goals provided', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard({ goals: [] });
      assert.ok(html.includes('No goals recorded yet'));
    });

    it('should render health module grid when health data is provided', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard({
        health: {
          overall: 'healthy',
          modules: {
            'forge-core': { status: 'healthy' },
            'ai-gateway': { status: 'degraded' },
          },
          alerts: [],
        },
      });
      assert.ok(html.includes('health-grid'));
      assert.ok(html.includes('forge-core'));
      assert.ok(html.includes('ai-gateway'));
    });

    it('should render activity log events when provided', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard({
        events: [
          { event_type: 'goal_started', message: 'Started goal A', created_at: new Date().toISOString() },
        ],
      });
      assert.ok(html.includes('goal_started'));
      assert.ok(html.includes('Started goal A'));
    });

    it('should escape HTML in goal text to prevent XSS', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard({
        goals: [
          { id: 'xss', text: '<script>alert("xss")</script>', status: 'running' },
        ],
      });
      assert.ok(!html.includes('<script>alert("xss")</script>'));
      assert.ok(html.includes('&lt;script&gt;'));
    });
  });

  describe('getStatus()', () => {
    it('should return a well-formed status object', () => {
      const dash = new ForgeDashboard({ port: 12345 });
      const status = dash.getStatus();
      assert.ok('running' in status);
      assert.ok('url' in status);
      assert.ok('port' in status);
      assert.ok('connections' in status);
      assert.ok('lastRefresh' in status);
      assert.equal(status.port, 12345);
    });
  });

  describe('collectData()', () => {
    it('should return a structured data object with all sections', () => {
      const dash = new ForgeDashboard();
      const data = dash.collectData({});
      assert.ok(Array.isArray(data.goals));
      assert.ok(typeof data.pool === 'object');
      assert.ok(typeof data.analytics === 'object');
      assert.ok(typeof data.health === 'object');
      assert.ok(typeof data.cost === 'object');
      assert.ok(Array.isArray(data.events));
    });

    it('should collect goals from a forge module', () => {
      const dash = new ForgeDashboard();
      const mockForge = {
        listGoals: () => [{ id: 'g1', text: 'Test', status: 'running' }],
      };
      const data = dash.collectData({ forge: mockForge });
      assert.equal(data.goals.length, 1);
      assert.equal(data.goals[0].id, 'g1');
    });

    it('should collect pool status from a pool module', () => {
      const dash = new ForgeDashboard();
      const mockPool = {
        getStatus: () => ({ totalWorkers: 4, activeWorkers: 2, queueDepth: 1, maxConcurrent: 8 }),
      };
      const data = dash.collectData({ pool: mockPool });
      assert.equal(data.pool.workerCount, 4);
      assert.equal(data.pool.activeWorkers, 2);
    });

    it('should collect cost data from a budget module', () => {
      const dash = new ForgeDashboard();
      const mockBudget = {
        getStatus: () => ({ totalCost: 1.5, maxCost: 10, costPerGoal: 0.5, tokensUsed: 50000 }),
      };
      const data = dash.collectData({ budget: mockBudget });
      assert.equal(data.cost.totalSpend, 1.5);
      assert.equal(data.cost.budgetMax, 10);
    });

    it('should handle module errors gracefully and return empty data', () => {
      const dash = new ForgeDashboard();
      const brokenForge = { listGoals: () => { throw new Error('boom'); } };
      const data = dash.collectData({ forge: brokenForge });
      assert.deepEqual(data.goals, []);
    });
  });

  describe('edge cases', () => {
    it('should handle stop() on a never-started dashboard without error', async () => {
      const dash = new ForgeDashboard();
      await dash.stop(); // should not throw
    });

    it('should handle generateDashboard with null data', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard(null);
      assert.ok(html.includes('<!DOCTYPE html>'));
    });

    it('should handle generateDashboard with undefined data', () => {
      const dash = new ForgeDashboard();
      const html = dash.generateDashboard(undefined);
      assert.ok(html.includes('<!DOCTYPE html>'));
    });
  });
});
