// =============================================================================
// enterpriseRoutes.js — 企业治理路由模块
// 从 httpServer.js 抽取的 /enterprise/* 路由
// =============================================================================

/**
 * 创建企业治理路由 handler 集合
 * @param {Object} application
 * @param {Object} helpers
 * @returns {Object} { handlers: Map<string, Function> }
 */
export function createEnterpriseRoutes(application, helpers) {
  const { enterpriseGovernanceService } = application;
  const { readEnterpriseJson, writeJson, writeErrorResponse, createOkEnvelope, createErrorEnvelope } = helpers;

  // ── GET /enterprise/health ──
  async function handleEnterpriseHealth(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope(enterpriseGovernanceService.getHealth(), { startedAt }));
  }

  // ── GET /enterprise/session ──
  async function handleEnterpriseSession(req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope({ authenticated: true, identity: req.enterpriseIdentity }, { startedAt }));
  }

  // ── GET /enterprise/roles ──
  async function handleEnterpriseRoles(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope(enterpriseGovernanceService.listRoles(), { startedAt }));
  }

  // ── GET /enterprise/users ──
  async function handleEnterpriseUsers(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope(enterpriseGovernanceService.listUsers(), { startedAt }));
  }

  // ── POST /enterprise/users ──
  async function handleEnterpriseUserUpsert(req, res, { startedAt }) {
    const body = await readEnterpriseJson({ request: req, response: res, startedAt, code: "enterprise_user_invalid_json" });
    if (!body) return;
    try {
      const result = enterpriseGovernanceService.upsertUser(body, req.enterpriseIdentity);
      await enterpriseGovernanceService.recordAudit({
        outcome: "allowed", method: "POST", path: "/enterprise/users", permission: "user:admin", statusCode: 200,
        code: "enterprise_user_upserted", identity: req.enterpriseIdentity,
        details: { userId: result.user?.userId, tenantId: result.user?.tenantId, role: result.user?.role },
      });
      writeJson(res, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeErrorResponse({ response: res, error, startedAt, fallbackCode: "enterprise_user_upsert_failed" });
    }
  }

  // ── POST /enterprise/users/revoke ──
  async function handleEnterpriseUserRevoke(req, res, { startedAt }) {
    const body = await readEnterpriseJson({ request: req, response: res, startedAt, code: "enterprise_user_invalid_json" });
    if (!body) return;
    try {
      const result = await enterpriseGovernanceService.revokeUser(body, req.enterpriseIdentity);
      await enterpriseGovernanceService.recordAudit({
        outcome: "allowed", method: "POST", path: "/enterprise/users/revoke", permission: "user:admin", statusCode: 200,
        code: "enterprise_user_revoked", identity: req.enterpriseIdentity,
        details: { userId: result.user?.userId, tenantId: result.user?.tenantId, role: result.user?.role },
      });
      writeJson(res, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeErrorResponse({ response: res, error, startedAt, fallbackCode: "enterprise_user_revoke_failed" });
    }
  }

  // ── GET /enterprise/security/readiness ──
  async function handleEnterpriseSecurityReadiness(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope(enterpriseGovernanceService.getSecurityReadiness(), { startedAt }));
  }

  // ── GET /enterprise/audit ──
  async function handleEnterpriseAudit(req, res, { startedAt, url }) {
    const limit = url?.searchParams?.get("limit") ?? 50;
    writeJson(res, 200, createOkEnvelope(await enterpriseGovernanceService.listAudit({ limit }), { startedAt }));
  }

  // ── GET /enterprise/audit/export ──
  async function handleEnterpriseAuditExport(req, res, { startedAt, url }) {
    const limit = url?.searchParams?.get("limit") ?? 200;
    const format = url?.searchParams?.get("format") ?? "jsonl";
    writeJson(res, 200, createOkEnvelope(await enterpriseGovernanceService.exportAudit({ limit, format }), { startedAt }));
  }

  // ── GET /enterprise/overview ──
  async function handleEnterpriseOverview(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope({ status: "ready", governance: enterpriseGovernanceService.getHealth() }, { startedAt }));
  }

  // ── 导出 ──
  const handlers = new Map([
    ["GET /enterprise/health", { handler: handleEnterpriseHealth, public: true }],
    ["GET /enterprise/session", { handler: handleEnterpriseSession, public: false, permission: "dashboard:read" }],
    ["GET /enterprise/roles", { handler: handleEnterpriseRoles, public: false, permission: "dashboard:read" }],
    ["GET /enterprise/users", { handler: handleEnterpriseUsers, public: false, permission: "user:admin" }],
    ["POST /enterprise/users", { handler: handleEnterpriseUserUpsert, public: false, permission: "user:admin" }],
    ["POST /enterprise/users/revoke", { handler: handleEnterpriseUserRevoke, public: false, permission: "user:admin" }],
    ["GET /enterprise/security/readiness", { handler: handleEnterpriseSecurityReadiness, public: false, permission: "audit:read" }],
    ["GET /enterprise/audit", { handler: handleEnterpriseAudit, public: false, permission: "audit:read" }],
    ["GET /enterprise/audit/export", { handler: handleEnterpriseAuditExport, public: false, permission: "audit:read" }],
    ["GET /enterprise/overview", { handler: handleEnterpriseOverview, public: false, permission: "audit:read" }],
  ]);

  return { handlers };
}
