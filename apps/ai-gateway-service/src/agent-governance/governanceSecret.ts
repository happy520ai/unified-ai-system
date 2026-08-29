/**
 * Governance secret resolution.
 *
 * The signing/encryption secret comes from the environment when provided;
 * otherwise a per-installation secret is generated once and persisted
 * under the gitignored governance data directory. Secrets are never
 * logged and never returned by any API surface.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface GovernanceSecretOptions {
  env?: Record<string, string | undefined>;
  dataDir?: string;
}

export function resolveGovernanceSecret(options: GovernanceSecretOptions = {}): string {
  const env = options.env ?? process.env;
  const dataDir = options.dataDir ?? ".data/agent-governance";
  const fromEnv = env.AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY;
  if (typeof fromEnv === "string" && fromEnv.trim().length >= 16) {
    return fromEnv.trim();
  }
  const secretPath = join(dataDir, "secret.key");
  if (existsSync(secretPath)) {
    const existing = readFileSync(secretPath, "utf8").trim();
    if (existing.length >= 32) return existing;
  }
  mkdirSync(dirname(secretPath), { recursive: true });
  const generated = `${randomUUID()}${randomUUID()}`.replace(/-/gu, "");
  const tmpPath = `${secretPath}.tmp`;
  writeFileSync(tmpPath, generated, { mode: 0o600 });
  renameSync(tmpPath, secretPath);
  return generated;
}
