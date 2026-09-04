import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGatewayApplication } from "./createGatewayApplication.js";

describe("Agent Governance application configuration", () => {
  it("keeps governance default-off so legacy execution route contracts remain compatible", () => {
    expect(createGatewayApplication({}).agentGovernance).toBeNull();
  });

  it("refuses explicit governance enablement with multi-instance mode", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_MULTI_INSTANCE: "true",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_MULTI_INSTANCE_UNSUPPORTED" }));
  });

  it("keeps governance explicitly disabled as a rollback boundary", () => {
    expect(createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "false",
    }).agentGovernance).toBeNull();
  });

  it("rejects an in-repository custom state directory outside protected .data", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-config-governance-key-0123456789",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: "state/agent-governance",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_DATA_DIR_UNSAFE" }));
  });

  it("admits only the exact reviewed Git high-risk allowlist and enables its durable effect gate", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-high-risk-config-"));
    try {
      const application = createGatewayApplication({
        AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
        AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-high-risk-governance-key-0123456789",
        AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
        AI_GATEWAY_AGENT_GOVERNANCE_HIGH_RISK_TOOLS: "git_push,git_create_pr,git_push",
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
        AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "effects.sqlite"),
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "application-high-risk-external-effect-key-0123456789",
      });
      expect(application.agentGovernance?.highRiskTools).toEqual(["git_push", "git_create_pr"]);
      expect(application.externalEffectGate.status).toMatchObject({ enabled: true, durable: true, mode: "sqlite" });
      await application.externalEffectGate.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects unknown high-risk tools and high-risk configuration with governance disabled", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_HIGH_RISK_TOOLS: "shell_exec",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_HIGH_RISK_TOOL_UNSUPPORTED" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "false",
      AI_GATEWAY_AGENT_GOVERNANCE_HIGH_RISK_TOOLS: "git_push",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_HIGH_RISK_REQUIRES_GOVERNANCE" }));
  });

  it("keeps model proposal explicit and bound to a server-owned provider", async () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_ENABLED: "sometimes",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_CONFIGURATION_INVALID" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_ENABLED: "true",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_MODEL_PROPOSER_REQUIRES_GOVERNANCE" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_ENABLED: "true",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_MODEL_PROPOSER_PROVIDER_REQUIRED" }));

    const root = await mkdtemp(join(tmpdir(), "agent-governance-model-config-"));
    try {
      const application = createGatewayApplication({
        AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
        AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-model-governance-key-0123456789",
        AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
        AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_ENABLED: "true",
        AI_GATEWAY_AGENT_GOVERNANCE_MODEL_PROPOSER_PROVIDER_ID: "local-fake-provider",
      });
      expect(application.agentGovernance).not.toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts only a trusted existing directory for Agent execution", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: "package.json",
    })).toThrow(expect.objectContaining({ code: "AGENT_EXEC_WORKING_DIRECTORY_INVALID" }));
  });

  it("keeps signed JSON as the default runtime Registry authority", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-json-authority-"));
    try {
      const application = createGatewayApplication({
        AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
        AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-json-authority-key-0123456789",
        AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
        AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "json",
      });
      expect(application.agentGovernance?.registryStore).toBeNull();
      expect(application.agentGovernance?.registry).toMatchObject({
        storageMode: "single-process-json",
        durable: true,
        transactional: false,
        distributed: false,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("starts a fresh checkpoint-verified SQLite Registry only with explicit single-host configuration", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-sqlite-authority-"));
    let application: ReturnType<typeof createGatewayApplication> | null = null;
    try {
      const dataDir = join(root, "governance");
      application = createGatewayApplication({
        AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
        AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-sqlite-registry-key-0123456789",
        AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: dataDir,
        AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "sqlite",
        AI_GATEWAY_AGENT_GOVERNANCE_HOST_ID: "test-host-a",
        AI_GATEWAY_AGENT_GOVERNANCE_SQLITE_PATH: join(dataDir, "registry.sqlite"),
      });
      expect(application.agentGovernance?.registryStore).not.toBeNull();
      expect(application.agentGovernance?.registry).toMatchObject({
        storageMode: "single-host-sqlite",
        transactional: true,
        rollbackProtected: true,
        wholeDirectoryRollbackProtected: false,
        checkpointVerified: true,
        recordCount: 0,
      });
    } finally {
      await application?.agentGovernance?.registryStore?.close?.();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("persists a generated Agent through the application SQLite authority across restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-sqlite-restart-"));
    const dataDir = join(root, "governance");
    const env = {
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-sqlite-restart-key-0123456789",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: dataDir,
      AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "sqlite",
      AI_GATEWAY_AGENT_GOVERNANCE_HOST_ID: "test-host-restart",
      AI_GATEWAY_AGENT_GOVERNANCE_SQLITE_PATH: join(dataDir, "registry.sqlite"),
    };
    let first: ReturnType<typeof createGatewayApplication> | null = null;
    let restarted: ReturnType<typeof createGatewayApplication> | null = null;
    try {
      first = createGatewayApplication(env);
      const generated = await first.agentGovernance!.service.generateAgent({
        name: "sqlite-restart-agent",
        task: "read one bounded file",
        requestedTools: ["file_read"],
        ttlSeconds: 3_600,
        parentAgentId: null,
      }, {
        tenantId: "tenant_a",
        userId: "operator_a",
        role: "admin",
        permissions: ["*"],
      });
      await first.agentGovernance?.registryStore?.close?.();
      first = null;

      restarted = createGatewayApplication(env);
      await expect(restarted.agentGovernance!.service.getAgent(generated.agentId, "tenant_a"))
        .resolves.toMatchObject({ agentId: generated.agentId, status: "ACTIVE" });
      expect(restarted.agentGovernance?.registry).toMatchObject({
        checkpointVerified: true,
        recordCount: 1,
      });
    } finally {
      await first?.agentGovernance?.registryStore?.close?.();
      await restarted?.agentGovernance?.registryStore?.close?.();
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  it("constructs a fresh single-owner PostgreSQL Registry and exposes its honest preview boundary", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-postgres-authority-"));
    let application: ReturnType<typeof createGatewayApplication> | null = null;
    try {
      application = createGatewayApplication({
        AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
        AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-postgres-registry-key-0123456789",
        AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
        AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "postgres",
        AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_URL: "postgresql://127.0.0.1:1/governance",
        AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_NAMESPACE: "test",
        AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_AUTHORITY_ID: "11111111-1111-4111-8111-111111111111",
      });
      expect(application.agentGovernance?.registry).toMatchObject({
        storageMode: "central-postgres",
        status: "starting",
        rollbackProtected: false,
        singleOwnerPreview: true,
        externalCheckpointConfigured: false,
      });
    } finally {
      await application?.agentGovernance?.registryStore?.close?.();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects ambiguous database configuration and unsupported PostgreSQL URL files", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-missing-host-registry-key-0123456789",
      AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "sqlite",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_INVALID" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-url-file-registry-key-0123456789",
      AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "postgres",
      AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_URL_FILE: "/run/secrets/never-read",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_REGISTRY_POSTGRES_URL_FILE_UNSUPPORTED" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-conflict-registry-key-0123456789",
      AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "json",
      AI_GATEWAY_AGENT_GOVERNANCE_HOST_ID: "stray-host",
    })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_CONFLICT" }));
  });

  it("enforces protected SQLite paths and complete PostgreSQL TLS/floor configuration", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-database-config-"));
    const common = {
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-database-config-key-0123456789",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
    };
    try {
      expect(() => createGatewayApplication({
        ...common,
        AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "sqlite",
        AI_GATEWAY_AGENT_GOVERNANCE_HOST_ID: "test-host",
        AI_GATEWAY_AGENT_GOVERNANCE_SQLITE_PATH: join(root, "outside.sqlite"),
      })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_REGISTRY_PATH_UNSAFE" }));

      expect(() => createGatewayApplication({
        ...common,
        AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "postgres",
        AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_URL: "postgresql://db.example.test/governance",
        AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_AUTHORITY_ID: "11111111-1111-4111-8111-111111111111",
      })).toThrow(expect.objectContaining({
        code: "AGENT_GOVERNANCE_REGISTRY_POSTGRES_TLS_VERIFY_REQUIRED",
      }));

      expect(() => createGatewayApplication({
        ...common,
        AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "postgres",
        AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_URL: "postgresql://127.0.0.1:1/governance",
        AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_AUTHORITY_ID: "11111111-1111-4111-8111-111111111111",
        AI_GATEWAY_AGENT_GOVERNANCE_POSTGRES_MINIMUM_REVISION: "1",
      })).toThrow(expect.objectContaining({ code: "AGENT_GOVERNANCE_REGISTRY_CONFIGURATION_INVALID" }));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses an unmigrated JSON source before creating SQLite target artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-unmigrated-json-"));
    const dataDir = join(root, "governance");
    const sqlitePath = join(dataDir, "registry.sqlite");
    const checkpointPath = join(dataDir, "agent-registry.checkpoint.json");
    try {
      await mkdir(dataDir, { recursive: true });
      await writeFile(join(dataDir, "agents.json"), '{"version":1,"agents":{}}\n', "utf8");
      expect(() => createGatewayApplication({
        AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
        AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "application-unmigrated-json-key-0123456789",
        AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: dataDir,
        AI_GATEWAY_AGENT_GOVERNANCE_REGISTRY_STORE_MODE: "sqlite",
        AI_GATEWAY_AGENT_GOVERNANCE_HOST_ID: "test-host",
        AI_GATEWAY_AGENT_GOVERNANCE_SQLITE_PATH: sqlitePath,
      })).toThrow(expect.objectContaining({ code: "AGENT_REGISTRY_AUTHORITY_SWITCH_REQUIRED" }));
      await expect(stat(sqlitePath)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(stat(checkpointPath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
