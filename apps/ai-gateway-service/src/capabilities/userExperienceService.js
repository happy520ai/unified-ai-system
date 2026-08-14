import { timingSafeEqual } from "node:crypto";
import { resolveKnowledgeTenantScope } from "../knowledge/knowledgeTenantScope.ts";

const MEMORY_SOURCE_ID = "long-term-memory";

export function createUserExperienceService({ config, gatewayService, knowledgeService, workflowService, env = {} }) {
  const auth = {
    enabled: Boolean(env.PME_AUTH_TOKEN),
    tenantMode: env.PME_TENANT_MODE ?? "optional",
  };

  return {
    getAuthStatus() {
      return {
        enabled: auth.enabled,
        tenantMode: auth.tenantMode,
        tokenHeader: "x-pme-auth-token",
        tenantHeader: null,
        tenantSource: "authenticated-enterprise-identity",
        clientTenantOverrideAllowed: false,
      };
    },

    getDashboard(requestContext = {}) {
      return {
        app: "PME Moving Earth",
        status: "ready",
        service: {
          endpoint: config.aiGatewayService.endpoint,
          providerMode: config.aiGatewayService.providerMode,
          realProviderEnabled: config.aiGatewayService.realProviderEnabled,
          fallbackEnabled: config.aiGatewayService.fallbackEnabled,
        },
        providers: gatewayService.getProviderDescriptors(),
        knowledge: knowledgeService.getHealth(toKnowledgeContext(requestContext)),
        workflow: workflowService.getHealth(),
        auth: this.getAuthStatus(),
        capabilities: {
          streamingChat: true,
          multiProviderSelection: true,
          fallbackExecution: Boolean(config.aiGatewayService.fallbackEnabled),
          dashboard: true,
          evaluationScoring: true,
          longTermMemory: true,
          explicitTextConnector: true,
          optionalAuthTenant: true,
          queryGraphRag: true,
        },
      };
    },

    saveMemory(request = {}, requestContext = {}) {
      const text = readRequiredString(request.text ?? request.content, "Memory text is required.");
      const title = readOptionalString(request.title) ?? "PME Memory";
      const tenant = requireAuthenticatedTenant(requestContext);
      const documentId = readOptionalString(request.documentId) ?? `memory-${Date.now()}`;
      const result = knowledgeService.loadDocuments({
        sourceId: MEMORY_SOURCE_ID,
        sourceTitle: "Long Term Memory",
        metadata: {
          capability: "long-term-memory",
        },
        documents: [
          {
            documentId,
            title,
            content: text,
            metadata: {
              kind: "memory",
              ...(request.metadata ?? {}),
              savedAt: new Date().toISOString(),
            },
          },
        ],
      }, toKnowledgeContext(requestContext));

      return {
        status: "saved",
        sourceId: MEMORY_SOURCE_ID,
        tenantId: tenant.tenantId,
        documentId,
        result,
      };
    },

    listMemory(requestContext = {}) {
      const tenant = requireAuthenticatedTenant(requestContext);
      const sources = knowledgeService.listSources(toKnowledgeContext(requestContext)).sources ?? [];
      const memorySource = sources.find((source) => source.sourceId === MEMORY_SOURCE_ID);
      const documents = memorySource?.documents ?? [];

      return {
        status: "ready",
        sourceId: MEMORY_SOURCE_ID,
        tenantId: tenant.tenantId,
        documentCount: documents.length,
        documents,
      };
    },

    retrieveMemory(request = {}, requestContext = {}) {
      const query = readRequiredString(request.query, "Memory retrieve query is required.");
      requireAuthenticatedTenant(requestContext);
      return knowledgeService.retrieve({
        ...request,
        query,
        sourceIds: [MEMORY_SOURCE_ID],
      }, toKnowledgeContext(requestContext));
    },

    importTextConnector(request = {}, requestContext = {}) {
      const connectorId = createSafeId(readRequiredString(request.connectorId ?? request.sourceId, "connectorId is required."));
      const content = readRequiredString(request.content ?? request.text, "Connector content is required.");
      const title = readOptionalString(request.title) ?? "Imported Connector Document";
      const documentId = readOptionalString(request.documentId) ?? `connector-document-${Date.now()}`;
      const sourceId = `connector-${connectorId}`;
      requireAuthenticatedTenant(requestContext);

      const result = knowledgeService.loadDocuments({
        sourceId,
        sourceTitle: title,
        metadata: {
          capability: "explicit-text-connector",
          connectorId,
        },
        documents: [
          {
            documentId,
            title,
            content,
            uri: request.uri,
            metadata: {
              kind: "connector-import",
              connectorId,
              ...(request.metadata ?? {}),
              importedAt: new Date().toISOString(),
            },
          },
        ],
      }, toKnowledgeContext(requestContext));

      return {
        status: "imported",
        connectorId,
        sourceId,
        documentId,
        result,
      };
    },

    scoreEvaluation(request = {}) {
      const answer = readRequiredString(request.answer ?? request.output, "Evaluation answer is required.");
      const expectedTerms = Array.isArray(request.expectedTerms)
        ? request.expectedTerms.map(String).filter(Boolean)
        : tokenize(readOptionalString(request.reference) ?? readOptionalString(request.query) ?? "");
      const normalizedAnswer = normalizeText(answer);
      const matchedTerms = expectedTerms.filter((term) => normalizedAnswer.includes(normalizeText(term)));
      const citations = Array.isArray(request.citations) ? request.citations : [];
      const termCoverage = expectedTerms.length ? matchedTerms.length / expectedTerms.length : 1;
      const citationScore = Math.min(1, citations.length / Math.max(1, Number(request.expectedCitationCount ?? 1)));
      const score = Number((termCoverage * 0.75 + citationScore * 0.25).toFixed(4));

      return {
        status: "scored",
        mode: "heuristic-local",
        score,
        passed: score >= Number(request.threshold ?? 0.6),
        termCoverage: Number(termCoverage.toFixed(4)),
        citationScore: Number(citationScore.toFixed(4)),
        matchedTerms,
        expectedTerms,
        notes: "Local deterministic scoring only; no external evaluator was called.",
      };
    },

    retrieveGraph(request = {}, requestContext = {}) {
      const query = readRequiredString(request.query, "Graph retrieval query is required.");
      const retrieve = knowledgeService.retrieve({
        ...request,
        query,
        topK: Math.min(5, Number(request.topK ?? 5)),
      }, toKnowledgeContext(requestContext));
      const graph = createQueryGraph(retrieve.chunks);

      return {
        status: "ready",
        mode: "query-graph-rag",
        query,
        retrieve,
        graph,
        notes: "Query-time graph is built from retrieved local knowledge chunks; this is not a full GraphRAG index.",
      };
    },
  };
}

export function isAuthorized({ enabled, expectedToken }, request) {
  if (!enabled) {
    return true;
  }

  const headers = request?.headers ?? {};
  const headerToken = headers["x-pme-auth-token"];
  const bearer = typeof headers.authorization === "string"
    ? headers.authorization.replace(/^Bearer\s+/i, "")
    : undefined;

  return safeCompare(headerToken, expectedToken) || safeCompare(bearer, expectedToken);
}

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

export function getRequestContext(request) {
  const identity = request?.enterpriseIdentity ?? null;
  return {
    tenantId: readOptionalString(identity?.tenantId),
    tenantScopeIdentity: identity,
  };
}

function toKnowledgeContext(requestContext = {}) {
  return {
    tenantScopeIdentity: requestContext.tenantScopeIdentity ?? null,
  };
}

function requireAuthenticatedTenant(requestContext = {}) {
  const identity = requestContext.tenantScopeIdentity ?? null;
  const scope = resolveKnowledgeTenantScope(identity, { required: true });
  return {
    identity,
    tenantId: scope.tenantId,
  };
}

function createQueryGraph(chunks) {
  const nodes = new Map();
  const edges = [];

  for (const chunk of chunks) {
    const documentId = chunk.document?.documentId ?? chunk.id;
    const documentNodeId = `document:${documentId}`;
    nodes.set(documentNodeId, {
      id: documentNodeId,
      type: "document",
      label: chunk.document?.title ?? documentId,
      metadata: chunk.document?.metadata ?? {},
    });

    for (const term of chunk.matchedTerms ?? []) {
      const termNodeId = `term:${term}`;
      nodes.set(termNodeId, {
        id: termNodeId,
        type: "term",
        label: term,
      });
      edges.push({
        source: documentNodeId,
        target: termNodeId,
        type: "mentions",
        weight: chunk.score ?? 0,
      });
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
  };
}

function readRequiredString(value, message) {
  const normalized = readOptionalString(value);

  if (!normalized) {
    const error = new Error(message);
    error.code = "CAPABILITY_VALIDATION_ERROR";
    error.category = "validation";
    throw error;
  }

  return normalized;
}

function readOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function createSafeId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeText(value) {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
