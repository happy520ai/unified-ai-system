/**
 * GoalTemplates -- domain-specific goal templates for common development tasks.
 *
 * Provides a library of pre-built goal templates that users can instantiate with
 * variable substitution. Includes keyword-based goal matching to automatically
 * suggest the best template for a natural-language goal description.
 *
 * Built-in categories:
 *   feature, bugfix, refactor, test, docs, migration, security, performance
 *
 * Usage:
 *   import { GoalTemplates } from './goal-templates/index.js';
 *
 *   const templates = new GoalTemplates();
 *   const all = templates.listTemplates();
 *   const match = templates.matchGoal('Add rate limiting to the API');
 *   const result = templates.instantiate('add-api-endpoint', {
 *     method: 'POST', path: '/users', service: 'user-service',
 *   });
 *   console.log(result.goalText); // "Add POST /users endpoint to user-service"
 */

// ── Built-in Template Definitions ──────────────────────────────────────────

/**
 * @typedef {object} TemplateVariable
 * @property {string} name - variable name (used as {{name}} in patterns)
 * @property {string} type - 'string' | 'enum' | 'boolean'
 * @property {string} description - human-readable description
 * @property {string} [default] - default value
 * @property {boolean} required - whether this variable must be supplied
 * @property {string[]} [options] - valid values when type is 'enum'
 */

/**
 * @typedef {object} GoalTemplate
 * @property {string} id - unique template identifier
 * @property {string} name - display name
 * @property {string} category - template category
 * @property {string} description - what this template does
 * @property {string} goalPattern - goal text with {{variable}} placeholders
 * @property {string[]} keywords - matching keywords for auto-detection
 * @property {TemplateVariable[]} variables - list of variables
 * @property {object} suggestedOptions - suggested Forge execution options
 */

/** @type {GoalTemplate[]} */
const BUILT_IN_TEMPLATES = [
  {
    id: 'add-feature',
    name: 'Add Feature',
    category: 'feature',
    description: 'Add a new feature to an existing module with full test coverage',
    goalPattern: 'Add {{description}} to {{module}} with full test coverage and documentation',
    keywords: ['add', 'feature', 'new', 'implement', 'create', 'build', 'module'],
    variables: [
      { name: 'module', type: 'string', description: 'Target module name', required: true },
      { name: 'description', type: 'string', description: 'Feature description', required: true },
    ],
    suggestedOptions: { useRefiner: true, maxConcurrent: 2, budget: { maxTokens: 300000 } },
  },
  {
    id: 'fix-bug',
    name: 'Fix Bug',
    category: 'bugfix',
    description: 'Fix a bug in a specific file with regression test',
    goalPattern: 'Fix the bug in {{file}} where {{behavior}} and add a regression test',
    keywords: ['fix', 'bug', 'error', 'crash', 'broken', 'issue', 'regression'],
    variables: [
      { name: 'file', type: 'string', description: 'File path containing the bug', required: true },
      { name: 'behavior', type: 'string', description: 'Description of the buggy behavior', required: true },
    ],
    suggestedOptions: { useRefiner: false, maxConcurrent: 1, budget: { maxTokens: 150000 } },
  },
  {
    id: 'add-tests',
    name: 'Add Tests',
    category: 'test',
    description: 'Add comprehensive tests for a module using a specific framework',
    goalPattern: 'Add comprehensive {{testFramework}} tests for {{module}} covering happy path, edge cases, and error scenarios',
    keywords: ['test', 'tests', 'testing', 'coverage', 'jest', 'vitest', 'pytest', 'spec'],
    variables: [
      { name: 'module', type: 'string', description: 'Module to test', required: true },
      { name: 'testFramework', type: 'string', description: 'Test framework name', required: false, default: 'Jest' },
    ],
    suggestedOptions: { useRefiner: false, maxConcurrent: 2, budget: { maxTokens: 200000 } },
  },
  {
    id: 'refactor-module',
    name: 'Refactor Module',
    category: 'refactor',
    description: 'Refactor a module to improve code quality',
    goalPattern: 'Refactor {{module}} to {{improvement}} while preserving all existing behavior and tests',
    keywords: ['refactor', 'improve', 'clean', 'restructure', 'simplify', 'extract', 'rename'],
    variables: [
      { name: 'module', type: 'string', description: 'Module to refactor', required: true },
      { name: 'improvement', type: 'string', description: 'Description of the improvement', required: true },
    ],
    suggestedOptions: { useRefiner: true, maxConcurrent: 1, budget: { maxTokens: 250000 } },
  },
  {
    id: 'add-api-endpoint',
    name: 'Add API Endpoint',
    category: 'feature',
    description: 'Add a new REST API endpoint to a service',
    goalPattern: 'Add {{method}} {{path}} endpoint to {{service}} with input validation, error handling, and tests',
    keywords: ['api', 'endpoint', 'route', 'rest', 'http', 'get', 'post', 'put', 'delete', 'patch'],
    variables: [
      { name: 'method', type: 'enum', description: 'HTTP method', required: true, options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      { name: 'path', type: 'string', description: 'URL path (e.g. /users)', required: true },
      { name: 'service', type: 'string', description: 'Service or module name', required: true },
    ],
    suggestedOptions: { useRefiner: true, maxConcurrent: 2, budget: { maxTokens: 300000 } },
  },
  {
    id: 'database-migration',
    name: 'Database Migration',
    category: 'migration',
    description: 'Migrate a database schema with rollback support',
    goalPattern: 'Migrate {{table}} schema to {{changes}} with forward and rollback migration scripts',
    keywords: ['database', 'migration', 'schema', 'table', 'column', 'sql', 'db', 'alter'],
    variables: [
      { name: 'table', type: 'string', description: 'Table name to migrate', required: true },
      { name: 'changes', type: 'string', description: 'Description of schema changes', required: true },
    ],
    suggestedOptions: { useRefiner: true, maxConcurrent: 1, budget: { maxTokens: 200000 } },
  },
  {
    id: 'add-auth',
    name: 'Add Authentication',
    category: 'security',
    description: 'Add authentication to a module',
    goalPattern: 'Add {{authType}} authentication to {{module}} with token validation and middleware',
    keywords: ['auth', 'authentication', 'jwt', 'token', 'login', 'session', 'oauth', 'apikey'],
    variables: [
      { name: 'authType', type: 'enum', description: 'Authentication type', required: true, options: ['JWT', 'OAuth2', 'API Key', 'Session', 'Basic'] },
      { name: 'module', type: 'string', description: 'Module to protect', required: true },
    ],
    suggestedOptions: { useRefiner: true, maxConcurrent: 1, budget: { maxTokens: 300000 } },
  },
  {
    id: 'performance-optimize',
    name: 'Performance Optimization',
    category: 'performance',
    description: 'Optimize performance in a specific target',
    goalPattern: 'Optimize {{target}} performance in {{module}} by adding caching, reducing allocations, and benchmarking improvements',
    keywords: ['performance', 'optimize', 'speed', 'cache', 'fast', 'latency', 'throughput', 'benchmark'],
    variables: [
      { name: 'target', type: 'string', description: 'Performance target (e.g. query, rendering)', required: true },
      { name: 'module', type: 'string', description: 'Module containing the target', required: true },
    ],
    suggestedOptions: { useRefiner: true, maxConcurrent: 1, budget: { maxTokens: 250000 } },
  },
  {
    id: 'security-hardening',
    name: 'Security Hardening',
    category: 'security',
    description: 'Harden a module against specific security threats',
    goalPattern: 'Harden {{module}} against {{threats}} with input sanitization, rate limiting, and security tests',
    keywords: ['security', 'harden', 'vulnerability', 'injection', 'xss', 'csrf', 'sanitize', 'csp'],
    variables: [
      { name: 'module', type: 'string', description: 'Module to harden', required: true },
      { name: 'threats', type: 'string', description: 'Security threats to address', required: true },
    ],
    suggestedOptions: { useRefiner: true, maxConcurrent: 1, budget: { maxTokens: 250000 } },
  },
  {
    id: 'add-error-handling',
    name: 'Add Error Handling',
    category: 'feature',
    description: 'Add comprehensive error handling to a module',
    goalPattern: 'Add comprehensive error handling to {{module}} with typed errors, retry logic, and graceful degradation',
    keywords: ['error', 'handling', 'try', 'catch', 'retry', 'graceful', 'fallback', 'exception'],
    variables: [
      { name: 'module', type: 'string', description: 'Module to add error handling to', required: true },
    ],
    suggestedOptions: { useRefiner: false, maxConcurrent: 1, budget: { maxTokens: 200000 } },
  },
  {
    id: 'documentation',
    name: 'Generate Documentation',
    category: 'docs',
    description: 'Generate comprehensive documentation for a module',
    goalPattern: 'Generate comprehensive documentation for {{module}} including JSDoc comments, README sections, and usage examples',
    keywords: ['documentation', 'docs', 'readme', 'jsdoc', 'comment', 'guide', 'manual', 'api-docs'],
    variables: [
      { name: 'module', type: 'string', description: 'Module to document', required: true },
    ],
    suggestedOptions: { useRefiner: false, maxConcurrent: 1, budget: { maxTokens: 150000 } },
  },
  {
    id: 'dependency-update',
    name: 'Update Dependency',
    category: 'migration',
    description: 'Update a dependency with compatibility verification',
    goalPattern: 'Update {{dependency}} from {{from}} to {{to}} with compatibility verification and breaking change fixes',
    keywords: ['dependency', 'update', 'upgrade', 'version', 'package', 'npm', 'pip', 'cargo'],
    variables: [
      { name: 'dependency', type: 'string', description: 'Dependency name', required: true },
      { name: 'from', type: 'string', description: 'Current version', required: true },
      { name: 'to', type: 'string', description: 'Target version', required: true },
    ],
    suggestedOptions: { useRefiner: true, maxConcurrent: 1, budget: { maxTokens: 200000 } },
  },
];

// ── GoalTemplates Class ─────────────────────────────────────────────────────

/**
 * GoalTemplates manages a library of domain-specific goal templates.
 * Supports listing, matching, instantiating, and registering custom templates.
 */
export class GoalTemplates {
  /** @type {Map<string, GoalTemplate>} */ #templates;
  /** @type {Map<string, GoalTemplate>} */ #customTemplates;

  /**
   * Create a new GoalTemplates instance with all built-in templates loaded.
   */
  constructor() {
    this.#templates = new Map();
    this.#customTemplates = new Map();
    for (const tmpl of BUILT_IN_TEMPLATES) {
      this.#templates.set(tmpl.id, tmpl);
    }
  }

  /**
   * List all available templates, optionally filtered by category.
   *
   * @param {string} [category] - optional category filter
   * @returns {Array<{ id: string, name: string, category: string, description: string, exampleGoal: string, variables: TemplateVariable[] }>}
   */
  listTemplates(category) {
    const all = [...this.#templates.values(), ...this.#customTemplates.values()];
    const filtered = category
      ? all.filter(t => t.category === category)
      : all;

    return filtered.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      exampleGoal: this.#replaceVariables(t.goalPattern, this.#defaultValues(t.variables)),
      variables: t.variables,
    }));
  }

  /**
   * Get a specific template by ID.
   *
   * @param {string} templateId - template identifier
   * @returns {GoalTemplate|null} the template, or null if not found
   */
  getTemplate(templateId) {
    return this.#templates.get(templateId) || this.#customTemplates.get(templateId) || null;
  }

  /**
   * Instantiate a template with provided variable values.
   * Replaces all {{variable}} placeholders in the goal pattern.
   *
   * @param {string} templateId - template identifier
   * @param {Record<string, string>} [variables={}] - variable values
   * @returns {{ goalText: string, suggestedOptions: object, templateMetadata: { id: string, name: string, category: string } }}
   * @throws {Error} if template not found or required variables missing
   */
  instantiate(templateId, variables = {}) {
    const tmpl = this.#templates.get(templateId) || this.#customTemplates.get(templateId);
    if (!tmpl) {
      throw new Error('Template not found: ' + templateId);
    }

    // Merge defaults with provided variables
    const merged = this.#defaultValues(tmpl.variables);
    for (const [k, v] of Object.entries(variables)) {
      if (v != null && v !== '') {
        merged[k] = String(v);
      }
    }

    // Validate required variables
    const missing = [];
    for (const v of tmpl.variables) {
      if (v.required && (!merged[v.name] || merged[v.name] === '')) {
        missing.push(v.name);
      }
    }
    if (missing.length > 0) {
      throw new Error('Missing required variables: ' + missing.join(', '));
    }

    // Validate enum values
    for (const v of tmpl.variables) {
      if (v.type === 'enum' && v.options && merged[v.name]) {
        if (!v.options.includes(merged[v.name])) {
          throw new Error(
            'Invalid value "' + merged[v.name] + '" for variable "' + v.name
            + '". Valid options: ' + v.options.join(', '),
          );
        }
      }
    }

    const goalText = this.#replaceVariables(tmpl.goalPattern, merged);

    return {
      goalText,
      suggestedOptions: tmpl.suggestedOptions || {},
      templateMetadata: {
        id: tmpl.id,
        name: tmpl.name,
        category: tmpl.category,
      },
    };
  }

  /**
   * Match a natural-language goal text to the best template using keyword scoring.
   *
   * @param {string} goalText - natural language goal description
   * @returns {{ template: GoalTemplate|null, confidence: number, matchedKeywords: string[], suggestions: string[] }}
   */
  matchGoal(goalText) {
    if (!goalText || typeof goalText !== 'string') {
      return { template: null, confidence: 0, matchedKeywords: [], suggestions: [] };
    }

    const lower = goalText.toLowerCase();
    const words = lower.split(/[\s,;:.!?]+/).filter(Boolean);
    const all = [...this.#templates.values(), ...this.#customTemplates.values()];

    let bestMatch = null;
    let bestScore = 0;
    let bestKeywords = [];

    for (const tmpl of all) {
      const matched = [];
      let score = 0;

      for (const kw of tmpl.keywords) {
        const kwLower = kw.toLowerCase();
        if (lower.includes(kwLower)) {
          matched.push(kw);
          // Exact word match scores higher
          if (words.includes(kwLower)) {
            score += 2;
          } else {
            score += 1;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = tmpl;
        bestKeywords = matched;
      }
    }

    // Normalize confidence to 0-1 range (max possible score ~ keyword count * 2)
    const maxPossibleScore = bestMatch ? bestMatch.keywords.length * 2 : 1;
    const confidence = Math.min(1, bestScore / Math.max(maxPossibleScore, 1));

    // Generate suggestions for top 3 matches
    const suggestions = [];
    const scored = all.map(tmpl => {
      let s = 0;
      for (const kw of tmpl.keywords) {
        if (lower.includes(kw.toLowerCase())) s++;
      }
      return { tmpl, score: s };
    }).sort((a, b) => b.score - a.score);

    for (const { tmpl } of scored.slice(1, 4)) {
      if (tmpl !== bestMatch) {
        suggestions.push('Try template "' + tmpl.id + '" for: ' + tmpl.description);
      }
    }

    return {
      template: bestMatch,
      confidence: Math.round(confidence * 100) / 100,
      matchedKeywords: bestKeywords,
      suggestions,
    };
  }

  /**
   * Register a custom template for later use.
   *
   * @param {GoalTemplate} template - template definition
   * @throws {Error} if template ID conflicts with a built-in template or is invalid
   */
  registerTemplate(template) {
    if (!template || !template.id || !template.goalPattern) {
      throw new Error('Template must have at least id and goalPattern');
    }
    if (this.#templates.has(template.id)) {
      throw new Error('Cannot override built-in template: ' + template.id);
    }

    // Ensure defaults
    const tmpl = {
      id: template.id,
      name: template.name || template.id,
      category: template.category || 'custom',
      description: template.description || 'Custom template',
      goalPattern: template.goalPattern,
      keywords: template.keywords || [],
      variables: template.variables || [],
      suggestedOptions: template.suggestedOptions || {},
    };

    this.#customTemplates.set(tmpl.id, tmpl);
  }

  /**
   * Get all available template categories.
   *
   * @returns {string[]} sorted list of unique categories
   */
  getCategories() {
    const cats = new Set();
    for (const t of this.#templates.values()) cats.add(t.category);
    for (const t of this.#customTemplates.values()) cats.add(t.category);
    return [...cats].sort();
  }

  /**
   * Get the current status of the template library.
   *
   * @returns {{ templateCount: number, customCount: number, categories: string[] }}
   */
  getStatus() {
    return {
      templateCount: this.#templates.size,
      customCount: this.#customTemplates.size,
      categories: this.getCategories(),
    };
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Build a defaults map from variable definitions.
   * @param {TemplateVariable[]} variables
   * @returns {Record<string, string>}
   */
  #defaultValues(variables) {
    const defaults = {};
    for (const v of variables) {
      if (v.default != null) {
        defaults[v.name] = String(v.default);
      } else {
        defaults[v.name] = '';
      }
    }
    return defaults;
  }

  /**
   * Replace {{variable}} placeholders in a pattern string.
   * @param {string} pattern - template pattern with {{name}} placeholders
   * @param {Record<string, string>} values - variable values
   * @returns {string} substituted string
   */
  #replaceVariables(pattern, values) {
    return pattern.replace(/\{\{(\w+)\}\}/g, (match, name) => {
      return values[name] != null ? values[name] : match;
    });
  }
}
