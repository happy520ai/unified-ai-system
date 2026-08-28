/**
 * Forge Auth Adapter — bridges the gateway's Enterprise Governance Service
 * with Forge's authentication layer.
 *
 * When integrated with the gateway, Forge uses this adapter to validate
 * API keys (uai-*), Bearer tokens, and X-PME-Auth-Token headers against
 * the gateway's credential stores and RBAC role system.
 *
 * In standalone mode, Forge falls back to its own UserManager (fk-* keys).
 */

import { resolveForgePermission } from './bridge.js';

const STANDALONE_ROLE_PERMISSIONS = Object.freeze({
  admin: Object.freeze(['*']),
  operator: Object.freeze(['public:read', 'dashboard:read', 'provider:read', 'chat:use', 'knowledge:read', 'knowledge:write', 'workflow:run', 'audit:read']),
  developer: Object.freeze(['public:read', 'dashboard:read', 'provider:read', 'knowledge:read', 'knowledge:write', 'workflow:run']),
  viewer: Object.freeze(['public:read', 'dashboard:read', 'provider:read', 'knowledge:read']),
  auditor: Object.freeze(['public:read', 'dashboard:read', 'audit:read']),
});

/**
 * Auth adapter that wraps the gateway's enterpriseGovernanceService.
 *
 * Usage:
 *   // In gateway integration mode:
 *   const adapter = new ForgeAuthAdapter({ governanceService: enterpriseGov });
 *
 *   // In standalone mode:
 *   const adapter = new ForgeAuthAdapter({ standalone: true, userManager: forgeUserMgr });
 */
export class ForgeAuthAdapter {
  #governanceService;
  #userManager;
  #standalone;

  /**
   * @param {object} options
   * @param {object} [options.governanceService] - Gateway's enterpriseGovernanceService instance
   * @param {object} [options.userManager] - Forge's UserManager (for standalone mode)
   * @param {boolean} [options.standalone] - If true, use Forge's own auth
   */
  constructor({ governanceService, userManager, standalone } = {}) {
    this.#governanceService = governanceService || null;
    this.#userManager = userManager || null;
    this.#standalone = standalone ?? !governanceService;
  }

  /**
   * Authenticate a request.
   *
   * Priority:
   * 1. Gateway governance service (if injected)
   * 2. Forge UserManager (standalone mode)
   * 3. null (unauthenticated)
   *
   * @param {import('node:http').IncomingMessage} req
   * @returns {{ authenticated: boolean, identity: object|null, authMethod: string|null, error?: object }}
   */
  authenticate(req) {
    // Mode 1: Gateway governance
    if (this.#governanceService) {
      try {
        const result = this.#governanceService.authenticate(req);
        if (result.authenticated) {
          return {
            authenticated: true,
            identity: {
              userId: result.identity.userId,
              tenantId: result.identity.tenantId,
              role: result.identity.role,
              permissions: result.identity.permissions,
              source: 'gateway',
            },
            authMethod: result.authMethod || 'gateway',
          };
        }
        return {
          authenticated: false,
          identity: null,
          authMethod: null,
          error: {
            statusCode: result.statusCode || 401,
            code: result.code || 'auth_failed',
            message: result.message || 'Authentication failed',
          },
        };
      } catch (err) {
        return {
          authenticated: false,
          identity: null,
          authMethod: null,
          error: {
            statusCode: 503,
            code: 'governance_auth_unavailable',
            message: 'Gateway governance authentication is unavailable',
          },
        };
      }
    }

    // Mode 2: Standalone (Forge UserManager)
    if (this.#userManager) {
      const key = req.headers['x-api-key'] ||
        (req.headers['authorization']?.startsWith('Bearer ')
          ? req.headers['authorization'].slice(7)
          : null);

      if (key) {
        const user = this.#userManager.getUserByApiKey(key);
        if (user) {
          this.#userManager.updateLastActive(user.id);
          return {
            authenticated: true,
            identity: {
              id: user.id,
              userId: user.id,
              username: user.username,
              tenantId: 'forge-standalone',
              role: user.role || 'operator',
              permissions: STANDALONE_ROLE_PERMISSIONS[user.role] ?? [],
              source: 'forge',
            },
            authMethod: 'forge-api-key',
          };
        }
      }
    }

    // Unauthenticated
    return {
      authenticated: false,
      identity: null,
      authMethod: null,
    };
  }

  /**
   * Authorize a request for a specific permission.
   *
   * @param {import('node:http').IncomingMessage} req
   * @param {string} permission - Permission string (e.g. 'workflow:run')
   * @returns {{ allowed: boolean, identity: object|null, permission: string, error?: object }}
   */
  authorize(req, permission) {
    const auth = this.authenticate(req);

    if (!auth.authenticated) {
      return {
        allowed: false,
        identity: null,
        permission,
        error: auth.error || {
          statusCode: 401,
          code: 'auth_required',
          message: 'Authentication required',
        },
      };
    }

    // Check permission
    const perms = auth.identity.permissions || [];
    const hasPermission = perms.includes('*') || perms.includes(permission);

    if (!hasPermission) {
      return {
        allowed: false,
        identity: auth.identity,
        permission,
        error: {
          statusCode: 403,
          code: 'permission_forbidden',
          message: `Permission "${permission}" required`,
        },
      };
    }

    return {
      allowed: true,
      identity: auth.identity,
      permission,
    };
  }

  /**
   * Resolve the required permission for a Forge route.
   * Delegates to the bridge module's FORGE_PERMISSIONS map.
   *
   * @param {string} method - HTTP method
   * @param {string} path - URL path
   * @returns {string} Permission string
   */
  resolvePermission(method, path) {
    const normalizedPath = String(path ?? '').startsWith('/api/')
      ? `/forge/${String(path).slice('/api/'.length)}`
      : path;
    return resolveForgePermission(method, normalizedPath);
  }

  /**
   * Check if running in standalone mode.
   * @returns {boolean}
   */
  isStandalone() {
    return this.#standalone;
  }

  /**
   * Get adapter status for dashboard.
   * @returns {object}
   */
  getStatus() {
    return {
      mode: this.#standalone ? 'standalone' : 'gateway-integrated',
      governanceService: !!this.#governanceService,
      userManager: !!this.#userManager,
    };
  }
}
