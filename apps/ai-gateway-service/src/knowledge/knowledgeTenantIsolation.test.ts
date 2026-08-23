import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createUserExperienceService, getRequestContext } from "../capabilities/userExperienceService.js";
import { dispatchHttpRoutes05 } from "../http/httpServerRoutes05.js";
import { dispatchHttpRoutes06 } from "../http/httpServerRoutes06.js";
import { createKnowledgePersistence } from "./knowledgePersistence.js";
import { createLocalKnowledgeService } from "./localKnowledgeService.js";

const tenantA = Object.freeze({ tenantId: "tenant-a", userId: "alice" });
const tenantB = Object.freeze({ tenantId: "tenant-b", userId: "bob" });
const contextA = Object.freeze({ tenantScopeIdentity: tenantA });
const contextB = Object.freeze({ tenantScopeIdentity: tenantB });
const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("knowledge tenant isolation", () => {
  it("isolates read, same-key poisoning, query cache, source summaries, and delete", async () => {
    const service = createLocalKnowledgeService({ storageMode: "memory" });
    try {
      service.loadDocuments(createLoad("alphavault91c7"), contextA);

      expect((await service.retrieve({ query: "alphavault91c7" }, contextA)).chunks).toHaveLength(1);
      expect((await service.retrieve({ query: "alphavault91c7" }, contextB)).chunks).toHaveLength(0);

      service.loadDocuments(createLoad("betapoison4f2d"), contextB);

      expect((await service.retrieve({ query: "betapoison4f2d" }, contextA)).chunks).toHaveLength(0);
      expect((await service.retrieve({ query: "betapoison4f2d" }, contextB)).chunks).toHaveLength(1);
      expect((await service.retrieve({ query: "alphavault91c7" }, contextA)).chunks).toHaveLength(1);

      const sourcesA = JSON.stringify(service.listSources(contextA));
      const sourcesB = JSON.stringify(service.listSources(contextB));
      expect(sourcesA).toContain("alphavault91c7");
      expect(sourcesA).not.toContain("betapoison4f2d");
      expect(sourcesB).toContain("betapoison4f2d");
      expect(sourcesB).not.toContain("alphavault91c7");
      expect(sourcesA).not.toContain("knowledge-tenant:v1:");

      expect(service.deleteDocument("shared-doc", contextB).deletedCount).toBe(1);
      expect((await service.retrieve({ query: "alphavault91c7" }, contextA)).chunks).toHaveLength(1);
      expect(service.deleteDocument("shared-doc", contextB).deletedCount).toBe(0);
    } finally {
      service.close();
    }
  });

  it("ignores spoofed tenant headers and body fields in long-term memory", async () => {
    const service = createLocalKnowledgeService({ storageMode: "memory" });
    const userExperience = createUserExperienceService({
      config: {
        aiGatewayService: {
          endpoint: "http://127.0.0.1:3000",
          providerMode: "fake",
          realProviderEnabled: false,
          fallbackEnabled: false,
        },
      },
      gatewayService: { getProviderDescriptors: () => [] },
      knowledgeService: service,
      workflowService: { getHealth: () => ({ status: "ready" }) },
    });
    try {
      const requestContext = getRequestContext({
        headers: { "x-pme-tenant-id": "tenant-a" },
        enterpriseIdentity: tenantB,
      });
      const saved = userExperience.saveMemory({
        tenantId: "tenant-a",
        documentId: "spoof-attempt",
        text: "serveridentitywins73aa",
        metadata: { tenantId: "tenant-a" },
      }, requestContext);

      expect(saved.tenantId).toBe("tenant-b");
      expect((await service.retrieve({ query: "serveridentitywins73aa" }, contextA)).chunks).toHaveLength(0);
      expect((await service.retrieve({ query: "serveridentitywins73aa" }, contextB)).chunks).toHaveLength(1);
    } finally {
      service.close();
    }
  });

  it("passes authenticated identity through the active load and retrieve dispatchers", async () => {
    const service = createLocalKnowledgeService({ storageMode: "memory" });
    try {
      const loadResponse = await dispatchKnowledgeRoute({
        dispatcher: dispatchHttpRoutes05,
        service,
        identity: tenantA,
        path: "/knowledge/load",
        body: createLoad("activeroutesecret55e1"),
      });
      expect(loadResponse.status).toBe(200);

      const tenantBResponse = await dispatchKnowledgeRoute({
        dispatcher: dispatchHttpRoutes06,
        service,
        identity: tenantB,
        path: "/knowledge/retrieve",
        body: { query: "activeroutesecret55e1" },
      });
      const tenantAResponse = await dispatchKnowledgeRoute({
        dispatcher: dispatchHttpRoutes06,
        service,
        identity: tenantA,
        path: "/knowledge/retrieve",
        body: { query: "activeroutesecret55e1" },
      });

      expect(tenantBResponse.payload.data.chunks).toHaveLength(0);
      expect(tenantAResponse.payload.data.chunks).toHaveLength(1);
    } finally {
      service.close();
    }
  });

  it.each(["file", "sqlite"])("preserves isolation across %s restart", async (storageMode) => {
    const root = await createTempRoot();
    const options = {
      storageMode,
      persistenceDir: root,
      fileStorePath: join(root, "knowledge.json"),
      sqlitePath: join(root, "knowledge.sqlite"),
    };
    const first = createLocalKnowledgeService(options);
    first.loadDocuments(createLoad("persistalpha91b1f0"), contextA);
    first.loadDocuments(createLoad("persistbeta829cc2"), contextB);
    first.close();

    const second = createLocalKnowledgeService(options);
    try {
      expect((await second.retrieve({ query: "persistalpha91b1f0" }, contextA)).chunks).toHaveLength(1);
      expect((await second.retrieve({ query: "persistalpha91b1f0" }, contextB)).chunks).toHaveLength(0);
      expect((await second.retrieve({ query: "persistbeta829cc2" }, contextB)).chunks).toHaveLength(1);
      expect((await second.retrieve({ query: "persistbeta829cc2" }, contextA)).chunks).toHaveLength(0);

      if (storageMode === "file") {
        const serialized = await readFile(options.fileStorePath, "utf8");
        expect(serialized).toContain('"version": 2');
        expect(serialized).not.toContain("tenant-a");
        expect(serialized).not.toContain("tenant-b");
      }
    } finally {
      second.close();
    }
  });

  it("fails closed without authenticated scope and ignores legacy unscoped files", async () => {
    const service = createLocalKnowledgeService({ storageMode: "memory" });
    try {
      expect(() => service.loadDocuments(createLoad("NO_SCOPE"))).toThrow(expect.objectContaining({
        code: "KNOWLEDGE_TENANT_CONTEXT_REQUIRED",
      }));
    } finally {
      service.close();
    }

    const root = await createTempRoot();
    const fileStorePath = join(root, "legacy.json");
    await writeFile(fileStorePath, JSON.stringify({
      version: 1,
      documents: [{
        sourceId: "legacy-source",
        documentId: "legacy-doc",
        text: "legacyunscopedsecret221a",
      }],
    }));
    const legacyService = createLocalKnowledgeService({ storageMode: "file", fileStorePath });
    try {
      expect((await legacyService.retrieve({ query: "legacyunscopedsecret221a" }, contextA)).chunks).toHaveLength(0);
      expect((await legacyService.retrieve({ query: "legacyunscopedsecret221a" }, contextB)).chunks).toHaveLength(0);
    } finally {
      legacyService.close();
    }

    const persistence = createKnowledgePersistence({
      storageMode: "file",
      fileStorePath: join(root, "direct.json"),
    });
    expect(() => persistence.saveDocuments([{
      sourceId: "unscoped",
      documentId: "unscoped",
      text: "must fail",
    }])).toThrow(expect.objectContaining({
      code: "KNOWLEDGE_PERSISTENCE_TENANT_SCOPE_REQUIRED",
    }));
  });
});

function createLoad(text: string) {
  return {
    sourceId: "shared-source",
    sourceTitle: "Shared public identifier",
    tenantId: "tenant-a",
    documents: [{
      documentId: "shared-doc",
      title: text,
      text,
      tenantId: "tenant-a",
    }],
  };
}

async function createTempRoot() {
  const root = await mkdtemp(join(tmpdir(), "knowledge-tenant-isolation-"));
  cleanupRoots.push(root);
  return root;
}

async function dispatchKnowledgeRoute({ dispatcher, service, identity, path, body }) {
  const response = { status: 0, payload: null };
  await dispatcher({
    request: { method: "POST", enterpriseIdentity: identity },
    response,
    url: { pathname: path },
    startedAt: Date.now(),
    knowledgeService: service,
    getRequestContext,
    readJson: async () => body,
    writeServiceLog() {},
    createOkEnvelope: (data) => ({ status: "ok", data }),
    createErrorEnvelope: (code, message, details = {}) => ({
      status: "error",
      error: { code, message, ...details },
    }),
    writeJson(target, status, payload) {
      target.status = status;
      target.payload = payload;
    },
  });
  return response;
}
