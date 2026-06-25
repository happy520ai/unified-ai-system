/**
 * P11 GoalTemplates Test Suite
 *
 * Tests for:
 *   - GoalTemplates (src/goal-templates/index.js)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GoalTemplates } from '../src/goal-templates/index.js';

describe('GoalTemplates', () => {
  describe('construction', () => {
    it('should create an instance with built-in templates loaded', () => {
      const gt = new GoalTemplates();
      assert.ok(gt instanceof GoalTemplates);
      const status = gt.getStatus();
      assert.ok(status.templateCount > 0);
      assert.equal(status.customCount, 0);
    });
  });

  describe('listTemplates()', () => {
    it('should return at least 12 built-in templates', () => {
      const gt = new GoalTemplates();
      const all = gt.listTemplates();
      assert.ok(all.length >= 12, `Expected >= 12 templates, got ${all.length}`);
    });

    it('should return objects with expected fields', () => {
      const gt = new GoalTemplates();
      const all = gt.listTemplates();
      for (const t of all) {
        assert.ok('id' in t, 'missing id');
        assert.ok('name' in t, 'missing name');
        assert.ok('category' in t, 'missing category');
        assert.ok('description' in t, 'missing description');
        assert.ok('exampleGoal' in t, 'missing exampleGoal');
        assert.ok('variables' in t, 'missing variables');
        assert.ok(Array.isArray(t.variables), 'variables should be array');
      }
    });

    it('should filter by category when category argument is provided', () => {
      const gt = new GoalTemplates();
      const securityTemplates = gt.listTemplates('security');
      assert.ok(securityTemplates.length > 0, 'Expected at least one security template');
      for (const t of securityTemplates) {
        assert.equal(t.category, 'security');
      }
    });

    it('should return empty array for a non-existent category', () => {
      const gt = new GoalTemplates();
      const result = gt.listTemplates('nonexistent-category-xyz');
      assert.deepEqual(result, []);
    });

    it('should include exampleGoal with defaults substituted', () => {
      const gt = new GoalTemplates();
      const all = gt.listTemplates();
      const addTests = all.find(t => t.id === 'add-tests');
      assert.ok(addTests);
      // The default for testFramework is 'Jest'
      assert.ok(addTests.exampleGoal.includes('Jest'), `Expected "Jest" in: ${addTests.exampleGoal}`);
    });
  });

  describe('getTemplate()', () => {
    it('should return a template by valid ID', () => {
      const gt = new GoalTemplates();
      const tmpl = gt.getTemplate('add-feature');
      assert.ok(tmpl);
      assert.equal(tmpl.id, 'add-feature');
      assert.equal(tmpl.category, 'feature');
    });

    it('should return null for an unknown template ID', () => {
      const gt = new GoalTemplates();
      const result = gt.getTemplate('does-not-exist-xyz');
      assert.equal(result, null);
    });

    it('should return template with expected structure', () => {
      const gt = new GoalTemplates();
      const tmpl = gt.getTemplate('fix-bug');
      assert.ok(tmpl);
      assert.ok(tmpl.goalPattern);
      assert.ok(Array.isArray(tmpl.keywords));
      assert.ok(tmpl.keywords.length > 0);
      assert.ok(Array.isArray(tmpl.variables));
      assert.ok(tmpl.suggestedOptions);
    });
  });

  describe('template categories', () => {
    it('should return all expected built-in categories', () => {
      const gt = new GoalTemplates();
      const cats = gt.getCategories();
      const expected = ['feature', 'bugfix', 'refactor', 'test', 'docs', 'migration', 'security', 'performance'];
      for (const c of expected) {
        assert.ok(cats.includes(c), `Expected category "${c}" in ${JSON.stringify(cats)}`);
      }
    });

    it('should return sorted categories', () => {
      const gt = new GoalTemplates();
      const cats = gt.getCategories();
      const sorted = [...cats].sort();
      assert.deepEqual(cats, sorted);
    });

    it('should return unique categories', () => {
      const gt = new GoalTemplates();
      const cats = gt.getCategories();
      const unique = [...new Set(cats)];
      assert.deepEqual(cats, unique);
    });
  });

  describe('instantiate() (renderTemplate / variable substitution)', () => {
    it('should substitute variables into the goal pattern', () => {
      const gt = new GoalTemplates();
      const result = gt.instantiate('add-api-endpoint', {
        method: 'POST',
        path: '/users',
        service: 'user-service',
      });
      assert.ok(result.goalText.includes('POST'));
      assert.ok(result.goalText.includes('/users'));
      assert.ok(result.goalText.includes('user-service'));
    });

    it('should return suggestedOptions and templateMetadata', () => {
      const gt = new GoalTemplates();
      const result = gt.instantiate('add-feature', {
        module: 'auth',
        description: 'OAuth2 login',
      });
      assert.ok(result.suggestedOptions);
      assert.ok(result.templateMetadata);
      assert.equal(result.templateMetadata.id, 'add-feature');
      assert.equal(result.templateMetadata.name, 'Add Feature');
      assert.equal(result.templateMetadata.category, 'feature');
    });

    it('should use default values when optional variables are omitted', () => {
      const gt = new GoalTemplates();
      const result = gt.instantiate('add-tests', { module: 'user-service' });
      // testFramework defaults to 'Jest'
      assert.ok(result.goalText.includes('Jest'));
    });

    it('should throw when required variables are missing', () => {
      const gt = new GoalTemplates();
      assert.throws(
        () => gt.instantiate('add-feature', {}),
        /Missing required variables/,
      );
    });

    it('should throw for an unknown template ID', () => {
      const gt = new GoalTemplates();
      assert.throws(
        () => gt.instantiate('nonexistent-template', {}),
        /Template not found/,
      );
    });

    it('should throw for invalid enum values', () => {
      const gt = new GoalTemplates();
      assert.throws(
        () => gt.instantiate('add-api-endpoint', {
          method: 'INVALID_METHOD',
          path: '/test',
          service: 'svc',
        }),
        /Invalid value/,
      );
    });

    it('should accept valid enum values', () => {
      const gt = new GoalTemplates();
      const result = gt.instantiate('add-api-endpoint', {
        method: 'DELETE',
        path: '/items/:id',
        service: 'inventory',
      });
      assert.ok(result.goalText.includes('DELETE'));
      assert.ok(result.goalText.includes('/items/:id'));
    });

    it('should handle empty variables object gracefully with defaults', () => {
      const gt = new GoalTemplates();
      // documentation template has only one required variable 'module'
      assert.throws(
        () => gt.instantiate('documentation', {}),
        /Missing required variables/,
      );
    });

    it('should produce fully substituted text with no remaining placeholders', () => {
      const gt = new GoalTemplates();
      const result = gt.instantiate('database-migration', {
        table: 'users',
        changes: 'add email column',
      });
      assert.ok(!result.goalText.includes('{{'), `Unresolved placeholder in: ${result.goalText}`);
    });
  });

  describe('matchGoal() keyword-based matching', () => {
    it('should match a feature-related goal to a feature template', () => {
      const gt = new GoalTemplates();
      const result = gt.matchGoal('Add a new feature to the auth module');
      assert.ok(result.template);
      assert.ok(result.confidence > 0);
      assert.ok(result.matchedKeywords.length > 0);
    });

    it('should match a bug fix goal', () => {
      const gt = new GoalTemplates();
      const result = gt.matchGoal('Fix the bug in login.js where it crashes on empty input');
      assert.ok(result.template);
      assert.equal(result.template.id, 'fix-bug');
    });

    it('should match a testing goal', () => {
      const gt = new GoalTemplates();
      const result = gt.matchGoal('Add comprehensive jest tests for the payment module');
      assert.ok(result.template);
      // Should match add-tests
      assert.equal(result.template.id, 'add-tests');
    });

    it('should match a security goal', () => {
      const gt = new GoalTemplates();
      const result = gt.matchGoal('Add JWT authentication to the API gateway');
      assert.ok(result.template);
      assert.equal(result.template.id, 'add-auth');
    });

    it('should return null template and zero confidence for empty input', () => {
      const gt = new GoalTemplates();
      const result = gt.matchGoal('');
      assert.equal(result.template, null);
      assert.equal(result.confidence, 0);
    });

    it('should return null template for null input', () => {
      const gt = new GoalTemplates();
      const result = gt.matchGoal(null);
      assert.equal(result.template, null);
      assert.equal(result.confidence, 0);
    });

    it('should return suggestions for alternative templates', () => {
      const gt = new GoalTemplates();
      const result = gt.matchGoal('Refactor the module to improve code quality and add tests');
      assert.ok(result.template);
      // Should have some suggestions from other templates
      assert.ok(Array.isArray(result.suggestions));
    });

    it('should return confidence between 0 and 1', () => {
      const gt = new GoalTemplates();
      const result = gt.matchGoal('Add rate limiting to the API endpoint');
      assert.ok(result.confidence >= 0);
      assert.ok(result.confidence <= 1);
    });

    it('should match database migration goals', () => {
      const gt = new GoalTemplates();
      const result = gt.matchGoal('Migrate the database schema to add a new column');
      assert.ok(result.template);
      assert.equal(result.template.id, 'database-migration');
    });

    it('should match performance optimization goals', () => {
      const gt = new GoalTemplates();
      const result = gt.matchGoal('Optimize the query performance with caching');
      assert.ok(result.template);
      assert.equal(result.template.id, 'performance-optimize');
    });
  });

  describe('registerTemplate() custom template registration', () => {
    it('should register a custom template successfully', () => {
      const gt = new GoalTemplates();
      gt.registerTemplate({
        id: 'custom-deploy',
        name: 'Deploy Service',
        category: 'ops',
        description: 'Deploy a service to production',
        goalPattern: 'Deploy {{service}} to {{environment}} with zero downtime',
        keywords: ['deploy', 'production', 'release', 'ship'],
        variables: [
          { name: 'service', type: 'string', description: 'Service name', required: true },
          { name: 'environment', type: 'string', description: 'Target environment', required: true },
        ],
      });

      const tmpl = gt.getTemplate('custom-deploy');
      assert.ok(tmpl);
      assert.equal(tmpl.id, 'custom-deploy');
      assert.equal(tmpl.category, 'ops');
    });

    it('should list custom templates alongside built-in ones', () => {
      const gt = new GoalTemplates();
      const beforeCount = gt.listTemplates().length;

      gt.registerTemplate({
        id: 'custom-lint',
        goalPattern: 'Run lint on {{target}}',
        keywords: ['lint'],
        variables: [{ name: 'target', type: 'string', description: 'target', required: true }],
      });

      const afterCount = gt.listTemplates().length;
      assert.equal(afterCount, beforeCount + 1);
    });

    it('should throw when overriding a built-in template', () => {
      const gt = new GoalTemplates();
      assert.throws(
        () => gt.registerTemplate({ id: 'add-feature', goalPattern: 'Override' }),
        /Cannot override built-in/,
      );
    });

    it('should throw when template lacks id', () => {
      const gt = new GoalTemplates();
      assert.throws(
        () => gt.registerTemplate({ goalPattern: 'No id' }),
        /must have at least id and goalPattern/,
      );
    });

    it('should throw when template lacks goalPattern', () => {
      const gt = new GoalTemplates();
      assert.throws(
        () => gt.registerTemplate({ id: 'no-pattern' }),
        /must have at least id and goalPattern/,
      );
    });

    it('should instantiate a custom template', () => {
      const gt = new GoalTemplates();
      gt.registerTemplate({
        id: 'custom-build',
        goalPattern: 'Build {{target}} with {{toolchain}}',
        keywords: ['build'],
        variables: [
          { name: 'target', type: 'string', description: 'Build target', required: true },
          { name: 'toolchain', type: 'string', description: 'Toolchain', required: true },
        ],
      });

      const result = gt.instantiate('custom-build', { target: 'frontend', toolchain: 'Vite' });
      assert.ok(result.goalText.includes('frontend'));
      assert.ok(result.goalText.includes('Vite'));
    });

    it('should match custom templates via matchGoal', () => {
      const gt = new GoalTemplates();
      gt.registerTemplate({
        id: 'custom-monitor',
        goalPattern: 'Set up monitoring for {{service}}',
        keywords: ['monitor', 'monitoring', 'observability', 'grafana', 'prometheus'],
        variables: [
          { name: 'service', type: 'string', description: 'Service', required: true },
        ],
      });

      const result = gt.matchGoal('Set up Grafana monitoring for the API service');
      assert.ok(result.template);
      assert.equal(result.template.id, 'custom-monitor');
    });

    it('should include custom template categories in getCategories', () => {
      const gt = new GoalTemplates();
      gt.registerTemplate({
        id: 'custom-ops',
        category: 'operations',
        goalPattern: 'Ops task {{desc}}',
        keywords: ['ops'],
        variables: [{ name: 'desc', type: 'string', description: 'desc', required: true }],
      });

      const cats = gt.getCategories();
      assert.ok(cats.includes('operations'));
    });

    it('should reflect custom count in getStatus', () => {
      const gt = new GoalTemplates();
      gt.registerTemplate({ id: 'c1', goalPattern: 'A', keywords: [] });
      gt.registerTemplate({ id: 'c2', goalPattern: 'B', keywords: [] });
      const status = gt.getStatus();
      assert.equal(status.customCount, 2);
    });
  });

  describe('edge cases', () => {
    it('should handle matchGoal with non-string input', () => {
      const gt = new GoalTemplates();
      const result = gt.matchGoal(42);
      assert.equal(result.template, null);
      assert.equal(result.confidence, 0);
    });

    it('should handle matchGoal with undefined input', () => {
      const gt = new GoalTemplates();
      const result = gt.matchGoal(undefined);
      assert.equal(result.template, null);
      assert.equal(result.confidence, 0);
    });

    it('should not leave unresolved placeholders when all variables supplied', () => {
      const gt = new GoalTemplates();
      const result = gt.instantiate('fix-bug', {
        file: 'src/auth.js',
        behavior: 'tokens expire prematurely',
      });
      assert.ok(!result.goalText.includes('{{'));
      assert.ok(result.goalText.includes('src/auth.js'));
      assert.ok(result.goalText.includes('tokens expire prematurely'));
    });

    it('should handle registerTemplate with minimal fields and apply defaults', () => {
      const gt = new GoalTemplates();
      gt.registerTemplate({ id: 'minimal-tmpl', goalPattern: 'Do {{thing}}' });
      const tmpl = gt.getTemplate('minimal-tmpl');
      assert.ok(tmpl);
      assert.equal(tmpl.category, 'custom');
      assert.equal(tmpl.name, 'minimal-tmpl');
      assert.equal(tmpl.description, 'Custom template');
      assert.deepEqual(tmpl.keywords, []);
    });

    it('should produce different output for different variable values', () => {
      const gt = new GoalTemplates();
      const r1 = gt.instantiate('add-feature', { module: 'A', description: 'X' });
      const r2 = gt.instantiate('add-feature', { module: 'B', description: 'Y' });
      assert.notEqual(r1.goalText, r2.goalText);
    });
  });
});
