import { createHash, randomUUID } from "node:crypto";
import type {
  AgentClassification,
  AgentFamily,
  AgentTrait,
  PolicyLayerContent,
} from "@unified-ai-system/shared-contracts";
import type { RiskLevel } from "@unified-ai-system/shared-contracts";
import type { GatewayService } from "../core/gatewayService.ts";
import type { ModelProposer } from "./agentGovernanceService.ts";
import { normalizeModelPolicyDraft } from "./modelPolicyDraft.ts";

const FAMILIES = new Set<AgentFamily>([
  "analysis",
  "execution",
  "communication",
  "monitoring",
  "development",
  "orchestration",
  "governance",
]);
const TRAITS = new Set<AgentTrait>([
  "read_only",
  "write_capable",
  "external_communication",
  "handles_sensitive_data",
  "financial_operation",
  "code_execution",
  "subagent_creator",
  "destructive_operation",
]);
const RISKS = new Set<RiskLevel>(["low", "medium", "high", "critical"]);
const CLASSIFICATION_KEY = /^[a-z][a-z0-9._-]{0,63}$/u;

type Proposal = Awaited<ReturnType<ModelProposer["proposeClassification"]>>;
type ProposalContext = Parameters<ModelProposer["proposeClassification"]>[1];

export function createGatewayModelProposer(options: {
  gatewayService: GatewayService;
  providerId: string;
  modelId?: string;
}): ModelProposer {
  const providerId = requireIdentifier(options.providerId, "providerId");
  const modelId = options.modelId ? requireIdentifier(options.modelId, "modelId") : undefined;
  return Object.freeze({
    async proposeClassification(task: string, context?: ProposalContext) {
      if (!context?.tenantId || !context.userId) {
        throw proposerError("AGENT_MODEL_PROPOSER_IDENTITY_REQUIRED");
      }
      const request = JSON.stringify({
        name: String(context.name ?? "").slice(0, 128),
        task: String(task ?? "").slice(0, 4_000),
        requestedTools: Array.isArray(context.requestedTools)
          ? context.requestedTools.slice(0, 128)
          : [],
      });
      const dispatchSeed = context.requestId || randomUUID();
      const result = await options.gatewayService.execute({
        taskType: "chat",
        providerId,
        ...(modelId ? { model: modelId } : {}),
        enterpriseIdentity: {
          tenantId: context.tenantId,
          userId: context.userId,
        },
        messages: [
          {
            role: "system",
            content: [
              "You propose an Agent classification and optional instance PolicyDraft; you never approve or grant permissions.",
              "Return exactly one JSON object with keys classification, proposedTraits, proposedRiskLevel, and optionally policyDraft.",
              "classification has family, domain, subclass. Use only documented family and trait names.",
              "policyDraft may only contain instance restrictions; it cannot choose requested tools, activate policies, or weaken parent/root rules.",
              "Do not include prose, Markdown, credentials, executable instructions, or any other keys.",
            ].join(" "),
          },
          { role: "user", content: request },
        ],
        options: { temperature: 0, maxOutputTokens: 1_024 },
        metadata: {
          source: "agent-governance-classifier",
          ...(context.requestId ? { requestId: context.requestId } : {}),
          internalProviderExecution: { governedByGateway: true, directAdapterCall: false },
        },
      }, {
        providerDispatchKeyHash: createHash("sha256")
          .update(`agent-governance-classifier\0${dispatchSeed}`, "utf8")
          .digest("hex"),
        providerDispatchRoute: "/__agent-governance/classify",
        providerDispatchInvocation: 1,
      });
      if (!result?.success) throw proposerError("AGENT_MODEL_PROPOSER_GATEWAY_FAILED");
      const content = result.data?.message?.content ?? result.data?.text ?? result.data?.outputText;
      return parseProposal(content);
    },
  });
}

export function createMockModelProposer(
  proposal: NonNullable<Proposal> | ((task: string) => NonNullable<Proposal>),
): ModelProposer {
  return Object.freeze({
    async proposeClassification(task: string) {
      const candidate = typeof proposal === "function" ? proposal(task) : proposal;
      return parseProposal(JSON.stringify(candidate));
    },
  });
}

function parseProposal(value: unknown): NonNullable<Proposal> {
  if (typeof value !== "string" || value.length < 2 || value.length > 16_000) {
    throw proposerError("AGENT_MODEL_PROPOSAL_INVALID");
  }
  const normalized = value.trim();
  if (!normalized.startsWith("{") || !normalized.endsWith("}")) {
    throw proposerError("AGENT_MODEL_PROPOSAL_INVALID");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw proposerError("AGENT_MODEL_PROPOSAL_INVALID");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw proposerError("AGENT_MODEL_PROPOSAL_INVALID");
  }
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).some((key) => ![
    "classification", "proposedTraits", "proposedRiskLevel", "policyDraft",
  ].includes(key))) {
    throw proposerError("AGENT_MODEL_PROPOSAL_INVALID");
  }
  const classification = record.classification as Record<string, unknown> | undefined;
  if (!classification || typeof classification !== "object" || Array.isArray(classification)
    || Object.keys(classification).some((key) => !["family", "domain", "subclass"].includes(key))
    || !FAMILIES.has(classification.family as AgentFamily)
    || typeof classification.domain !== "string" || !CLASSIFICATION_KEY.test(classification.domain)
    || typeof classification.subclass !== "string" || !CLASSIFICATION_KEY.test(classification.subclass)
    || !Array.isArray(record.proposedTraits)
    || record.proposedTraits.some((trait) => typeof trait !== "string" || !TRAITS.has(trait as AgentTrait))
    || new Set(record.proposedTraits).size !== record.proposedTraits.length
    || !RISKS.has(record.proposedRiskLevel as RiskLevel)) {
    throw proposerError("AGENT_MODEL_PROPOSAL_INVALID");
  }
  const policyDraft = record.policyDraft === undefined
    ? undefined
    : normalizeModelPolicyDraft(record.policyDraft);
  return Object.freeze({
    classification: Object.freeze({
      family: classification.family as AgentFamily,
      domain: classification.domain,
      subclass: classification.subclass,
    }) as AgentClassification,
    proposedTraits: Object.freeze([...record.proposedTraits]) as unknown as string[],
    proposedRiskLevel: record.proposedRiskLevel as RiskLevel,
    ...(policyDraft ? { policyDraft: policyDraft as PolicyLayerContent } : {}),
  });
}

function requireIdentifier(value: unknown, field: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 160 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new TypeError(`${field} must be a bounded identifier.`);
  }
  return normalized;
}

function proposerError(code: string) {
  return Object.assign(new Error("Agent model classification proposal was unavailable or invalid."), {
    name: code,
    code,
  });
}
