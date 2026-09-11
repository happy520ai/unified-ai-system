import { randomUUID } from "node:crypto";
import type { GatewayExecutionContext } from "../http/httpRequestExecution.ts";
import { inheritVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";
import { externalRunnerHash as hash } from "../workforce/workforceExternalRunnerProfile.ts";
import { continuationJsonCopy } from "../workforce/taskQueueContinuation.ts";

/** Only a current server authentication projection can issue this non-secret reference. */
export type ResidentAuthorityReference = Readonly<{ version: 1; kind: "configured-user" | "virtual-key";
  fingerprint: string; tenantId: string; userId: string }>;
export type GovernedAgentTaskResidentGrant = Readonly<{
  version: 1; grantId: string; taskId: string; tenantId: string; userId: string; agentId: string;
  profileHash: string; reviewHash: string; planHash: string; authority: ResidentAuthorityReference; authorityIdentityHash: string;
  createdAt: number; expiresAt: number; chunkIterations: number; maxChunks: number; grantHash: string;
}>;
export type GovernedAgentTaskResidentState = Readonly<{
  grant: GovernedAgentTaskResidentGrant; enabled: boolean; chunks: number; stopReason: string | null;
}>;
type ResidentExecution = Readonly<{
  taskId: string; grantHash: string; assertActive(): Promise<void>;
}>;
const issued = new WeakSet<object>();
const executions = new WeakMap<object, ResidentExecution>();
const HASH = /^sha256:[a-f0-9]{64}$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const text = (value: unknown) => typeof value === "string" && value.trim() === value && value.length > 0
  && value.length <= 256 && !/[\u0000-\u001f\u007f]/u.test(value);
export function residentTaskError(reason: string, statusCode = 409) {
  return Object.assign(new Error("The original task cannot run in the resident pool."), {
    code: "AGENT_POOL_" + reason, statusCode, retryable: false,
  });
}
export function readResidentGrant(input: unknown): GovernedAgentTaskResidentGrant {
  const value = continuationJsonCopy(input) as GovernedAgentTaskResidentGrant;
  if (!value || Object.keys(value).sort().join("|") !== "agentId|authority|authorityIdentityHash|chunkIterations|createdAt|expiresAt|grantHash|grantId|maxChunks|planHash|profileHash|reviewHash|taskId|tenantId|userId|version"
    || value.version !== 1 || !UUID.test(value.grantId) || !UUID.test(value.taskId)
    || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(value.agentId) || !text(value.tenantId) || !text(value.userId)
    || ![value.profileHash, value.reviewHash, value.planHash, value.grantHash, value.authorityIdentityHash].every(item => HASH.test(item))
    || !value.authority || typeof value.authority !== "object" || Array.isArray(value.authority)
    || Object.keys(value.authority).sort().join("|") !== "fingerprint|kind|tenantId|userId|version"
    || value.authority.version !== 1 || !["configured-user", "virtual-key"].includes(value.authority.kind)
    || !/^[a-f0-9]{12}$/u.test(value.authority.fingerprint) || value.authority.tenantId !== value.tenantId
    || value.authority.userId !== value.userId
    || !Number.isSafeInteger(value.createdAt) || !Number.isSafeInteger(value.expiresAt) || value.createdAt < 0
    || value.expiresAt <= value.createdAt || value.expiresAt - value.createdAt > 86400000
    || !Number.isSafeInteger(value.chunkIterations) || value.chunkIterations < 1 || value.chunkIterations > 10
    || !Number.isSafeInteger(value.maxChunks) || value.maxChunks < 1 || value.maxChunks > 10000) throw residentTaskError("GRANT_INVALID");
  const { grantHash, ...body } = value;
  if (hash(body) !== grantHash) throw residentTaskError("GRANT_INVALID");
  return Object.freeze({ ...value, authority: Object.freeze({ ...value.authority }) });
}
export function issueResidentGrant(input: Omit<GovernedAgentTaskResidentGrant, "version" | "grantId" | "grantHash" | "createdAt">,
  now = Date.now()): GovernedAgentTaskResidentGrant {
  const body = { version: 1 as const, grantId: randomUUID(), ...input, createdAt: now };
  const grant = readResidentGrant({ ...body, grantHash: hash(body) }); issued.add(grant); return grant;
}
export function assertIssuedResidentGrant(grant: GovernedAgentTaskResidentGrant) {
  if (!issued.has(grant)) throw residentTaskError("GRANT_NOT_ISSUED", 403);
  readResidentGrant(grant);
}
export function readResidentState(input: unknown): GovernedAgentTaskResidentState | null {
  if (input === null || input === undefined) return null;
  const value = continuationJsonCopy(input) as GovernedAgentTaskResidentState;
  if (!value || Object.keys(value).sort().join("|") !== "chunks|enabled|grant|stopReason" || typeof value.enabled !== "boolean"
    || !Number.isSafeInteger(value.chunks) || value.chunks < 0 || !(value.stopReason === null || text(value.stopReason))) throw residentTaskError("STATE_INVALID");
  const grant = readResidentGrant(value.grant);
  if (value.chunks > grant.maxChunks) throw residentTaskError("STATE_INVALID");
  return Object.freeze({ ...value, grant });
}
/** Fresh internal ingress; JSON and copied HTTP objects cannot acquire this execution capability. */
export function createResidentExecution(options: {
  grant: GovernedAgentTaskResidentGrant; source: GatewayExecutionContext; assertActive(): Promise<void>;
}): GatewayExecutionContext {
  const grant = readResidentGrant(options.grant), source = options.source;
  if (!(source.signal instanceof AbortSignal) || !Number.isFinite(source.deadlineAt)
    || source.deadlineAt > grant.expiresAt || typeof options.assertActive !== "function") throw residentTaskError("EXECUTION_INVALID");
  const execution = Object.freeze({ ...source, providerDispatchRoute: `/internal/agent-pool/${grant.taskId}/run`,
    providerDispatchKeyHash: hash(["resident-chunk/v1", grant.grantHash, randomUUID()]).slice(7), providerDispatchKeyInvalid: false });
  inheritVirtualKeyRequestAccounting(source, execution);
  executions.set(execution, Object.freeze({ taskId: grant.taskId, grantHash: grant.grantHash, assertActive: options.assertActive }));
  return execution;
}
export function getResidentExecution(value: unknown): ResidentExecution | undefined {
  return value && typeof value === "object" ? executions.get(value) : undefined;
}
export function inheritResidentExecution(source: unknown, target: object): void {
  const binding = getResidentExecution(source);
  if (binding) executions.set(target, binding);
}
