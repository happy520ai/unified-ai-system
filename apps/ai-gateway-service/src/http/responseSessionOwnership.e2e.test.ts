// @test-isolation process
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import OpenAI from "openai";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGuardrailsEngineForTests, setGuardrailsEngineForTests } from "../guardrails/guardrailsEngine.ts";
import { createGatewayHttpServer } from "./httpServer.js";

describe("Responses ownership over real HTTP", () => {
  it.each([false, true])("binds stored Responses to the authenticated key across GET, chain and DELETE (stream=%s)", async stream => {
    const root = mkdtempSync(join(realpathSync(tmpdir()), "response-session-http-"));
    const priorCwd = process.cwd();
    let server: ReturnType<typeof createGatewayHttpServer> | undefined;
    const engine = createGuardrailsEngineForTests({ enabled: true });
    setGuardrailsEngineForTests(engine);
    try {
      // All relative defaults are test-owned too; static repo-root stores are overridden below.
      process.chdir(root);
      const application = createGatewayApplication({
        NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
        AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "false", AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
        AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1", PME_ENTERPRISE_AUTH_ENABLED: "true",
        PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"), PME_API_KEY_STORE_PATH: join(root, "api-keys.json"),
        PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
        AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"), AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"),
        AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: root,
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"),
        AI_GATEWAY_LOCAL_CLIENT_DISCOVERY_HINTS_PATH: join(root, "client-hints.json"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "client-executions.jsonl"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
        KNOWLEDGE_STORAGE_MODE: "memory", KNOWLEDGE_PERSISTENCE_DIR: join(root, "knowledge"),
        KNOWLEDGE_FILE_STORE_PATH: join(root, "knowledge.json"), WORKFLOW_OUTPUT_DIR: join(root, "workflow"),
        WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "workforce"),
      });
      const manager = application.enterpriseGovernanceService.getApiKeyManager();
      const owner = manager.create({ role: "operator", tenantId: "session-a", rateLimit: { requestsPerMinute: 100 } });
      const peer = manager.create({ role: "operator", tenantId: "session-a", rateLimit: { requestsPerMinute: 100 } });
      const otherTenant = manager.create({ role: "operator", tenantId: "session-b", rateLimit: { requestsPerMinute: 100 } });
      const provider = application.providerRegistry.get("local-fake-provider");
      const generate = vi.spyOn(provider, "generate");
      const generateStream = vi.spyOn(provider, "generateStream");
      const stored = vi.spyOn(application.responseSessionStore, "set");
      server = createGatewayHttpServer(application);
      await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Fixture HTTP server did not bind.");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const sdk = new OpenAI({ baseURL: `${baseUrl}/v1`, apiKey: owner.key, maxRetries: 0 });
      const request = (key: string, method: string, path: string, body?: unknown) => fetch(`${baseUrl}${path}`, {
        method, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const created = await request(owner.key, "POST", "/v1/responses", {
        model: "local-fake-model", input: "Owned synthetic response", stream, store: true,
        metadata: { tenantId: "session-b", userId: "body-spoof", apiKeyFingerprint: "body-spoof" },
      });
      expect(created.status).toBe(200);
      const wire = await created.text();
      const result = stream ? wire.split("\n").filter(line => line.startsWith("data: ") && line.slice(6).trim() !== "[DONE]")
        .map(line => JSON.parse(line.slice(6))).find(event => event.type === "response.completed")?.response : JSON.parse(wire);
      expect(result).toMatchObject({ id: expect.stringMatching(/^resp_/), status: "completed", store: true });
      expect(result.output_text).toContain("Owned synthetic response");
      expect(stored).toHaveBeenCalledOnce();
      const path = `/v1/responses/${result.id}`;
      const ownRead = await request(owner.key, "GET", path);
      const ownPayload = await ownRead.json();
      expect({ status: ownRead.status, payload: ownPayload }).toMatchObject({ status: 200,
        payload: { id: result.id, output_text: result.output_text } });
      expect(await sdk.responses.retrieve(result.id)).toMatchObject({ id: result.id, output_text: result.output_text });
      const priorCalls = generate.mock.calls.length + generateStream.mock.calls.length;
      for (const outsider of [peer, otherTenant]) {
        for (const method of ["GET", "POST", "DELETE"]) {
          const denied = await request(outsider.key, method, method === "POST" ? "/v1/responses" : path,
            method === "POST" ? { model: "local-fake-model", input: "Unauthorized continuation", previous_response_id: result.id,
              tenantId: "session-a", userId: `api-key:${owner.record.keyFingerprint}`,
              metadata: { tenantId: "session-a", apiKeyFingerprint: owner.record.keyFingerprint },
              unified_ai: { enterpriseIdentity: { tenantId: "session-a", apiKeyFingerprint: owner.record.keyFingerprint } } } : undefined);
          expect(denied.status).toBe(404);
          expect(await denied.json()).toMatchObject({ error: { code: "response_not_found" } });
          expect(generate.mock.calls.length + generateStream.mock.calls.length).toBe(priorCalls);
        }
      }
      const peerSdk = new OpenAI({ baseURL: `${baseUrl}/v1`, apiKey: peer.key, maxRetries: 0 });
      await expect(peerSdk.responses.retrieve(result.id)).rejects.toMatchObject({ status: 404, code: "response_not_found" });
      expect(generate.mock.calls.length + generateStream.mock.calls.length).toBe(priorCalls);
      const continued = await request(owner.key, "POST", "/v1/responses", {
        model: "local-fake-model", input: "Owner continuation", previous_response_id: result.id, store: true,
      });
      expect(continued.status).toBe(200);
      const next = await continued.json() as any;
      expect(next).toMatchObject({ previous_response_id: result.id, status: "completed", store: true });
      expect((await request(owner.key, "GET", `/v1/responses/${next.id}`)).status).toBe(200);

      engine.applyOverrides({ bannedTerms: ["fake:"] });
      const nowBlocked = await request(owner.key, "GET", path);
      expect(nowBlocked.status).toBe(400);
      expect(await nowBlocked.json()).toMatchObject({ error: { code: "guardrail_blocked" } });
      stored.mockClear();
      const beforeBlocked = generate.mock.calls.length;
      const blocked = await request(owner.key, "POST", "/v1/responses", {
        model: "local-fake-model", input: "Block only the generated marker", store: true,
      });
      expect(blocked.status).toBe(400);
      expect(await blocked.json()).toMatchObject({ error: { code: "guardrail_blocked" } });
      expect(generate).toHaveBeenCalledTimes(beforeBlocked + 1);
      expect(stored).not.toHaveBeenCalled();
      for (const id of [result.id, next.id]) {
        if (id === next.id) {
          const deleted = await sdk.responses.delete(id).withResponse();
          expect(deleted.response.status).toBe(200);
        } else {
          const deleted = await request(owner.key, "DELETE", `/v1/responses/${id}`);
          expect(deleted.status).toBe(200);
          expect(await deleted.json()).toMatchObject({ id, deleted: true });
        }
        expect((await request(owner.key, "GET", `/v1/responses/${id}`)).status).toBe(404);
      }
    } finally {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close(error => error ? reject(error) : resolve()); server!.closeAllConnections?.();
        });
        await (server as typeof server & { shutdownResources?: () => Promise<void> }).shutdownResources?.();
        expect(server.listening).toBe(false);
      }
      setGuardrailsEngineForTests(null);
      process.chdir(priorCwd);
      expect(realpathSync(root)).toBe(root);
      expect(dirname(root)).toBe(realpathSync(tmpdir()));
      rmSync(root, { recursive: true, force: true });
    }
  });
});
