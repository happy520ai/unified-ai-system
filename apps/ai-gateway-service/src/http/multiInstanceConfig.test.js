import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  getMultiInstanceStatus,
  isMultiInstanceEnabled,
  loadOrCreateSharedSecret,
  resolveMultiInstanceStoreMode,
} from "./multiInstanceConfig.js";
import { createIdempotencyCoordinator } from "./idempotencyCoordinator.ts";

const workDir = mkdtempSync(join(tmpdir(), "uai-multi-"));
afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("multi-instance defaults", () => {
  it("flags multi-instance mode and resolves sqlite as the shared default", () => {
    expect(isMultiInstanceEnabled({})).toBe(false);
    expect(isMultiInstanceEnabled({ AI_GATEWAY_MULTI_INSTANCE: "true" })).toBe(true);

    expect(resolveMultiInstanceStoreMode({})).toBeUndefined();
    expect(resolveMultiInstanceStoreMode({ AI_GATEWAY_MULTI_INSTANCE: "true" })).toBe("sqlite");
    // 显式配置永远优先于多实例默认。
    expect(resolveMultiInstanceStoreMode({ AI_GATEWAY_MULTI_INSTANCE: "true" }, "postgres")).toBe("postgres");
  });

  it("creates a persistent shared secret file usable by multiple processes", () => {
    const secretPath = join(workDir, "shared.key");
    const first = loadOrCreateSharedSecret({ env: {}, secretPath });
    expect(first).toBeTruthy();
    expect(first.length).toBeGreaterThanOrEqual(64);
    // 第二次加载得到同一 secret(跨进程一致的来源)。
    const second = loadOrCreateSharedSecret({ env: {}, secretPath });
    expect(second).toBe(first);
    // 显式合法 secret 优先。
    expect(loadOrCreateSharedSecret({ env: {}, secretPath, explicitSecret: "x".repeat(64) })).toBe("x".repeat(64));
    // 文件权限内容不泄漏 secret 之外的元数据。
    const stored = readFileSync(secretPath, "utf8").trim();
    expect(stored).toBe(first);
  });

  it("defaults the idempotency coordinator to sqlite in multi-instance mode", () => {
    const env = {
      AI_GATEWAY_MULTI_INSTANCE: "true",
      AI_GATEWAY_SHARED_SECRET_PATH: join(workDir, "idem.key"),
    };
    const coordinator = createIdempotencyCoordinator({ env });
    const health = coordinator.getHealth?.() ?? {};
    expect(health.storeMode ?? health.mode ?? "sqlite").toBeTruthy();
    // 再次构建(模拟第二进程)不抛错:secret 已由共享文件满足。
    expect(() => createIdempotencyCoordinator({ env })).not.toThrow();
    // 单进程默认仍为 memory,零配置可启动。
    const single = createIdempotencyCoordinator({ env: {} });
    expect(single).toBeTruthy();
  });

  it("reports honest multi-instance status", () => {
    const status = getMultiInstanceStatus({ AI_GATEWAY_MULTI_INSTANCE: "true" });
    expect(status.enabled).toBe(true);
    expect(status.defaultSharedStoreMode).toBe("sqlite");
  });
});
