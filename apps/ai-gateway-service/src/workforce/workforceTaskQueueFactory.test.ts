import { describe, expect, it } from "vitest";

import {
  createWorkforceTaskQueueManager,
  workforceTaskQueueFactoryInternals,
} from "./workforceTaskQueueFactory.ts";

describe("Workforce task queue store selection", () => {
  it("keeps the atomic local queue as the credential-free single-instance default", async () => {
    const queue = createWorkforceTaskQueueManager({ env: {} });
    try {
      expect(queue.getInfo()).toMatchObject({
        persistence: "atomic-json-local",
        claimEnforced: true,
      });
    } finally {
      await queue.close();
    }
  });

  it("fails closed when real multi-instance execution selects local task state", () => {
    expect(() => createWorkforceTaskQueueManager({
      env: {
        AI_GATEWAY_MULTI_INSTANCE: "true",
        WORKFORCE_EXECUTION_ENABLED: "true",
        AI_GATEWAY_WORKFORCE_QUEUE_STORE_MODE: "local",
      },
    })).toThrow(expect.objectContaining({ code: "WORKFORCE_QUEUE_CENTRAL_STORE_REQUIRED" }));
  });

  it("requires the central queue and claims to share a database and fenced mode", () => {
    expect(() => createWorkforceTaskQueueManager({
      env: {
        AI_GATEWAY_WORKFORCE_QUEUE_STORE_MODE: "postgres",
        AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL: "postgresql://gateway@127.0.0.1/queue",
        AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL: "postgresql://gateway@127.0.0.1/claims",
      },
    })).toThrow(expect.objectContaining({ code: "WORKFORCE_QUEUE_CLAIM_DATABASE_MISMATCH" }));

    expect(() => createWorkforceTaskQueueManager({
      env: {
        AI_GATEWAY_WORKFORCE_QUEUE_STORE_MODE: "postgres",
        AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL: "postgresql://gateway@127.0.0.1/gateway",
        AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE: "memory",
      },
    })).toThrow(expect.objectContaining({ code: "WORKFORCE_QUEUE_FENCED_CLAIM_REQUIRED" }));
  });

  it("requires verify-full TLS for a non-loopback PostgreSQL target", () => {
    expect(() => workforceTaskQueueFactoryInternals.assertSecurePostgresUrl(
      "postgresql://gateway@db.example.test/gateway?sslmode=require",
      {},
    )).toThrow(expect.objectContaining({ code: "WORKFORCE_QUEUE_POSTGRES_TLS_VERIFY_REQUIRED" }));
    expect(() => workforceTaskQueueFactoryInternals.assertSecurePostgresUrl(
      "postgresql://gateway@db.example.test/gateway?sslmode=verify-full",
      {},
    )).not.toThrow();
  });
});
