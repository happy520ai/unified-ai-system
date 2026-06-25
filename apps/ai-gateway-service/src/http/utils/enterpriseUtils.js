// =============================================================================
// enterpriseUtils.js — 企业相关工具函数
// 从 httpServer.js 提取的企业报告/概览工具
// =============================================================================

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const __dirname = resolve(import.meta.dirname, "../../../..");
const enterpriseAcceptanceReportPath = resolve(__dirname, "docs/ENTERPRISE_ACCEPTANCE_REPORT.md");
const enterpriseAcceptanceEvidencePath = resolve(__dirname, "apps/ai-gateway-service/evidence/phase-43a-enterprise-acceptance-report.json");
const enterpriseReleaseCandidateEvidencePath = resolve(__dirname, "apps/ai-gateway-service/evidence/phase-44a-enterprise-release-candidate-dry-run.json");

/**
 * 读取企业验收报告
 */
export async function readEnterpriseAcceptanceReport() {
  try {
    const [reportMarkdown, evidenceText] = await Promise.all([
      readFile(enterpriseAcceptanceReportPath, "utf8"),
      readFile(enterpriseAcceptanceEvidencePath, "utf8"),
    ]);
    const evidence = JSON.parse(evidenceText);

    return {
      phase: "phase-44a-enterprise-acceptance-ui",
      mode: "read-only-existing-artifacts",
      reportMarkdown,
      evidence,
      artifactPaths: {
        reportMarkdown: enterpriseAcceptanceReportPath,
        evidenceJson: enterpriseAcceptanceEvidencePath,
      },
    };
  } catch (error) {
    return {
      phase: "phase-44a-enterprise-acceptance-ui",
      mode: "read-only-existing-artifacts",
      error: error.message,
      reportMarkdown: null,
      evidence: null,
    };
  }
}

/**
 * 读取企业发布候选 Dry-Run
 */
export async function readEnterpriseReleaseCandidateDryRun() {
  try {
    const evidenceText = await readFile(enterpriseReleaseCandidateEvidencePath, "utf8");
    const evidence = JSON.parse(evidenceText);

    return {
      phase: "phase-44a-enterprise-release-candidate-dry-run",
      mode: "read-only-existing-artifacts",
      evidence,
      artifactPath: enterpriseReleaseCandidateEvidencePath,
    };
  } catch (error) {
    return {
      phase: "phase-44a-enterprise-release-candidate-dry-run",
      mode: "read-only-existing-artifacts",
      error: error.message,
      evidence: null,
    };
  }
}

/**
 * 读取企业概览
 */
export async function readEnterpriseOverview(application) {
  const { enterpriseGovernanceService, gatewayService, knowledgeService, workforceService } = application;

  return {
    phase: "phase-44a-enterprise-overview",
    governance: enterpriseGovernanceService.getHealth(),
    providers: gatewayService.getProviderDescriptors().length,
    knowledge: knowledgeService.getHealth(),
    workforce: workforceService.getHealth(),
    timestamp: Date.now(),
  };
}

/**
 * 构建 Phase 319 功能状态
 */
export function buildPhase319FeatureStatus() {
  return {
    features: [
      { id: "chat", status: "real", description: "Real chat with NVIDIA provider" },
      { id: "knowledge", status: "local", description: "Local keyword retrieval" },
      { id: "workforce", status: "dry-run", description: "Workforce planning (dry-run)" },
      { id: "enterprise", status: "ready", description: "Enterprise governance" },
      { id: "observability", status: "ready", description: "Prometheus metrics + pino logs" },
    ],
    timestamp: Date.now(),
  };
}

/**
 * 读取能力 JSON
 */
export async function readCapabilityJson({ request, response, startedAt, code }) {
  try {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    return text ? JSON.parse(text) : {};
  } catch (error) {
    if (response && !response.writableEnded) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({
        status: "error",
        error: { code: code ?? "invalid_json", message: "Invalid JSON" },
        meta: { startedAt, completedAt: Date.now() },
      }));
    }
    return null;
  }
}

/**
 * 读取企业 JSON
 */
export async function readEnterpriseJson({ request, response, startedAt, code }) {
  return readCapabilityJson({ request, response, startedAt, code });
}
