/**
 * Enterprise Routes
 * Handles all /enterprise/* endpoints
 */

import { createOkEnvelope, createErrorEnvelope } from "@unified-ai-system/shared-utils";
import { resolve as resolvePath } from "node:path";
import { readFile } from "node:fs/promises";

const repoRoot = resolvePath(import.meta.dirname || ".", "../../../..");
const enterpriseAcceptanceReportPath = resolvePath(repoRoot, "docs/ENTERPRISE_ACCEPTANCE_REPORT.md");
const enterpriseReleaseCandidateEvidencePath = resolvePath(repoRoot, "apps/ai-gateway-service/evidence/phase-45a-enterprise-release-candidate-dry-run.json");

export function createEnterpriseRoutes({ application, readJson, writeJson, writeServiceLog, startedAt }) {
  const { enterpriseGovernanceService, enterpriseOpsService } = application;

  return {
    async handleEnterpriseHealth(url, request, response) {
      writeJson(response, 200, createOkEnvelope(enterpriseGovernanceService.getHealth(), { startedAt }));
      return true;
    },
    async handleEnterpriseSession(url, request, response) {
      writeJson(response, 200, createOkEnvelope({
        authenticated: true,
        identity: request.enterpriseIdentity,
      }, { startedAt }));
      return true;
    },
    async handleEnterpriseRoles(url, request, response) {
      writeJson(response, 200, createOkEnvelope(enterpriseGovernanceService.listRoles(), { startedAt }));
      return true;
    },
    async handleEnterpriseUsers(url, request, response) {
      writeJson(response, 200, createOkEnvelope(enterpriseGovernanceService.listUsers(), { startedAt }));
      return true;
    },
    async handleEnterpriseUserCreate(url, request, response) {
      const body = await readJson(request);
      if (!body) return false;
      try {
        const result = enterpriseGovernanceService.upsertUser(body, request.enterpriseIdentity);
        await enterpriseGovernanceService.recordAudit({
          outcome: "allowed", method: "POST", path: "/enterprise/users",
          permission: "user:admin", statusCode: 200, code: "enterprise_user_upserted",
          identity: request.enterpriseIdentity,
          details: { userId: result.user?.userId, tenantId: result.user?.tenantId, role: result.user?.role },
        });
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
      } catch (error) {
        writeJson(response, 400, createErrorEnvelope("enterprise_user_upsert_failed", error.message, { startedAt }));
      }
      return true;
    },
    async handleEnterpriseUserRevoke(url, request, response) {
      const body = await readJson(request);
      if (!body) return false;
      try {
        const result = enterpriseGovernanceService.revokeUser(body, request.enterpriseIdentity);
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
      } catch (error) {
        writeJson(response, 400, createErrorEnvelope("enterprise_user_revoke_failed", error.message, { startedAt }));
      }
      return true;
    },
    async handleEnterpriseSecurityReadiness(url, request, response) {
      writeJson(response, 200, createOkEnvelope(enterpriseGovernanceService.getSecurityReadiness(), { startedAt }));
      return true;
    },
    async handleEnterpriseAudit(url, request, response) {
      const limit = url.searchParams.get("limit") ?? 50;
      writeJson(response, 200, createOkEnvelope(await enterpriseGovernanceService.listAudit({ limit }), { startedAt }));
      return true;
    },
    async handleEnterpriseAuditExport(url, request, response) {
      const limit = url.searchParams.get("limit") ?? 200;
      const format = url.searchParams.get("format") ?? "jsonl";
      writeJson(response, 200, createOkEnvelope(await enterpriseGovernanceService.exportAudit({ limit, format }), { startedAt }));
      return true;
    },
    async handleEnterpriseAcceptanceReport(url, request, response) {
      try {
        const content = await readFile(enterpriseAcceptanceReportPath, "utf8");
        writeJson(response, 200, createOkEnvelope({ report: content, phase: "phase-43a" }, { startedAt }));
      } catch {
        writeJson(response, 404, createErrorEnvelope("report_not_found", "Acceptance report not found.", { startedAt }));
      }
      return true;
    },
    async handleEnterpriseReleaseCandidateDryRun(url, request, response) {
      try {
        const content = await readFile(enterpriseReleaseCandidateEvidencePath, "utf8");
        writeJson(response, 200, createOkEnvelope({ evidence: JSON.parse(content), phase: "phase-45a" }, { startedAt }));
      } catch {
        writeJson(response, 200, createOkEnvelope({ status: "no-evidence", phase: "phase-45a" }, { startedAt }));
      }
      return true;
    },
    async handleEnterpriseOverview(url, request, response) {
      const health = enterpriseGovernanceService.getHealth();
      const readiness = enterpriseOpsService.getReadiness();
      writeJson(response, 200, createOkEnvelope({
        phase: "phase-47a",
        health,
        deploymentReadiness: readiness,
        overview: "Enterprise overview aggregated from existing routes.",
      }, { startedAt }));
      return true;
    },
    async handleEnterpriseDeploymentReadiness(url, request, response) {
      writeJson(response, 200, createOkEnvelope(enterpriseOpsService.getReadiness(), { startedAt }));
      return true;
    },
    async handleEnterpriseStartupReadiness(url, request, response) {
      writeJson(response, 200, createOkEnvelope(enterpriseOpsService.getStartupReadiness(), { startedAt }));
      return true;
    },
    async handleEnterpriseBackup(url, request, response) {
      const body = await readJson(request);
      if (!body) return false;
      try {
        const result = await enterpriseOpsService.createBackup(body, request.enterpriseIdentity);
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
      } catch (error) {
        writeJson(response, 400, createErrorEnvelope("enterprise_backup_failed", error.message, { startedAt }));
      }
      return true;
    },
    async handleEnterpriseRestoreValidate(url, request, response) {
      const body = await readJson(request);
      if (!body) return false;
      try {
        const result = await enterpriseOpsService.validateRestore(body);
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
      } catch (error) {
        writeJson(response, 400, createErrorEnvelope("enterprise_restore_validate_failed", error.message, { startedAt }));
      }
      return true;
    },
  };
}
