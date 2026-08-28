import { describe, expect, it } from "vitest";

import {
  resolveLocalClientLoopbackAdapterConfiguration,
} from "./localClientLoopbackAdapterConfig.ts";

const MANIFEST_A = "a".repeat(64);
const MANIFEST_B = "b".repeat(64);

describe("local-client loopback adapter configuration", () => {
  it("keeps all adapters disabled by default without exposing secret references", () => {
    const result = resolveLocalClientLoopbackAdapterConfiguration({});
    expect(result).toEqual({
      enabled: false,
      source: "disabled",
      entries: [],
      registryIntegritySecretRef: null,
      status: {
        enabled: false,
        source: "disabled",
        adapterCount: 0,
        tenantCount: 0,
        clientCount: 0,
        secretReferencesExposed: false,
        gatewayAuthoritySecretRequired: true,
        gatewayClientSecretReuseForbidden: true,
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("normalizes the legacy single-adapter environment with safe defaults", () => {
    const result = resolveLocalClientLoopbackAdapterConfiguration({
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
      AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF:
        "file_key_path:registry-integrity.hex",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:43120",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID: "Tenant-A",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID: "desktop.one",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256: MANIFEST_A,
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF: "file_key_path:desktop-one.hex",
    });
    expect(result).toMatchObject({
      enabled: true,
      source: "legacy-single",
      registryIntegritySecretRef: "file_key_path:registry-integrity.hex",
      entries: [{
        adapterId: "builtin.loopback.local-client",
        tenantId: "Tenant-A",
        clientId: "desktop.one",
        timeoutMs: 5_000,
        challengeTtlMs: 2_000,
        verificationTtlMs: 300_000,
        maxResponseBytes: 16_384,
      }],
    });
  });

  it("supports a bounded versioned multi-client configuration and dedicated registry key", () => {
    const result = resolveLocalClientLoopbackAdapterConfiguration({
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "1",
      AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF: "file_key_path:registry-integrity.hex",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ADAPTERS_JSON: JSON.stringify({
        version: 1,
        adapters: [
          {
            adapterId: "loopback.desktop.one",
            tenantId: "Tenant-A",
            clientId: "desktop.one",
            endpoint: "http://127.0.0.1:43120",
            manifestSha256: MANIFEST_A,
            secretRef: "file_key_path:desktop-one.hex",
          },
          {
            adapterId: "loopback.desktop.two",
            tenantId: "Tenant-B",
            clientId: "desktop.two",
            endpoint: "http://[::1]:43121",
            manifestSha256: MANIFEST_B,
            secretRef: "file_key_path:desktop-two.hex",
            timeoutMs: 7_000,
            challengeTtlMs: 1_500,
            verificationTtlMs: 120_000,
            maxResponseBytes: 8_192,
          },
        ],
      }),
    });
    expect(result.status).toEqual({
      enabled: true,
      source: "versioned-json",
      adapterCount: 2,
      tenantCount: 2,
      clientCount: 2,
      secretReferencesExposed: false,
      gatewayAuthoritySecretRequired: true,
      gatewayClientSecretReuseForbidden: true,
    });
    expect(result.entries.map((entry) => entry.adapterId)).toEqual([
      "loopback.desktop.one",
      "loopback.desktop.two",
    ]);
    expect(result.registryIntegritySecretRef).toBe("file_key_path:registry-integrity.hex");
    expect(JSON.stringify(result.status)).not.toContain("file_key_path");
    expect(Object.isFrozen(result.entries)).toBe(true);
    expect(result.entries.every(Object.isFrozen)).toBe(true);
  });

  it.each([
    {
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "false",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:1",
    },
    {
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ADAPTERS_JSON: "not-json",
    },
    {
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:43120",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID: "Tenant-A",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID: "desktop.one",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256: MANIFEST_A,
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF: "file_key_path:desktop-one.hex",
    },
    {
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ADAPTERS_JSON: JSON.stringify({ version: 2, adapters: [] }),
    },
    {
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:1",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ADAPTERS_JSON: JSON.stringify({ version: 1, adapters: [] }),
    },
    {
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ADAPTERS_JSON: JSON.stringify({
        version: 1,
        adapters: [{
          adapterId: "loopback.one",
          tenantId: "Tenant-A",
          clientId: "desktop.one",
          endpoint: "http://127.0.0.1:1",
          manifestSha256: MANIFEST_A,
          secretRef: "file_key_path:one.hex",
          unknown: true,
        }],
      }),
    },
    {
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ADAPTERS_JSON: JSON.stringify({
        version: 1,
        adapters: [
          {
            adapterId: "loopback.same",
            tenantId: "Tenant-A",
            clientId: "desktop.one",
            endpoint: "http://127.0.0.1:1",
            manifestSha256: MANIFEST_A,
            secretRef: "file_key_path:one.hex",
          },
          {
            adapterId: "loopback.same",
            tenantId: "Tenant-B",
            clientId: "desktop.two",
            endpoint: "http://127.0.0.1:2",
            manifestSha256: MANIFEST_B,
            secretRef: "file_key_path:two.hex",
          },
        ],
      }),
      AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF: "file_key_path:registry.hex",
    },
    {
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ADAPTERS_JSON: JSON.stringify({
        version: 1,
        adapters: [
          {
            adapterId: "loopback.one",
            tenantId: "Tenant-A",
            clientId: "desktop.same",
            endpoint: "http://127.0.0.1:1",
            manifestSha256: MANIFEST_A,
            secretRef: "file_key_path:one.hex",
          },
          {
            adapterId: "loopback.two",
            tenantId: "Tenant-A",
            clientId: "desktop.same",
            endpoint: "http://127.0.0.1:2",
            manifestSha256: MANIFEST_B,
            secretRef: "file_key_path:two.hex",
          },
        ],
      }),
      AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF: "file_key_path:registry.hex",
    },
    {
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ADAPTERS_JSON: JSON.stringify({
        version: 1,
        adapters: [
          {
            adapterId: "loopback.one",
            tenantId: "Tenant-A",
            clientId: "desktop.one",
            endpoint: "http://127.0.0.1:1",
            manifestSha256: MANIFEST_A,
            secretRef: "file_key_path:one.hex",
          },
          {
            adapterId: "loopback.two",
            tenantId: "Tenant-B",
            clientId: "desktop.two",
            endpoint: "http://127.0.0.1:2",
            manifestSha256: MANIFEST_B,
            secretRef: "file_key_path:two.hex",
          },
        ],
      }),
    },
  ])("fails closed for invalid or ambiguous configuration %#", (env) => {
    expect(() => resolveLocalClientLoopbackAdapterConfiguration(env)).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_LOOPBACK_ADAPTER_CONFIG_INVALID",
      statusCode: 503,
    }));
  });
});
