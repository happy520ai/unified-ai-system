import { createHash } from 'node:crypto';

const PROFILE = ['version', 'mode', 'profileId', 'projectId', 'baselineRevision', 'roleId', 'readPaths', 'writePaths', 'verification', 'artifactLimits'];
const ROLE = ['version', 'mode', 'profileId', 'maxTotalRequests', 'maxConcurrentRoles', 'bindings'];
const BINDING = ['roleId', 'employeeId', 'providerId', 'modelId', 'maxRequests', 'maxInputTokens', 'maxOutputTokens', 'timeoutMs'];
const VERIFY = ['verificationId', 'command', 'immutableTests', 'image', 'workspaceMode', 'networkAccess', 'timeoutMs', 'maxMemoryMB', 'maxOutputBytes', 'pidsLimit', 'cpus'];
const PROTECTED = new Set(['.git', '.gitattributes', '.gitmodules', '.gitconfig', '.forge', '.mcp.json', '.ssh', '.aws', '.azure', '.gcp', '.npmrc', '.netrc', '.git-credentials', 'credentials', 'credentials.json', 'auth.json', 'evidence']);
const SECRET = /\b(?:xox[abprs]-[A-Za-z0-9-]{10,}|xapp-[A-Za-z0-9-]{20,}|(?:sk_live_|rk_live_|whsec_)[A-Za-z0-9]{16,}|npm_[A-Za-z0-9]{20,}|tp-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|hf_[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b|\bAuthorization\s*:\s*Bearer\s+\S+|\b[A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|ACCESS[_-]?KEY)[A-Z0-9_]*\s*[:=]\s*[^\s]{4,}|\b(?:https?|postgres(?:ql)?):\/\/[^:\s/@]+:[^@\s/]+@|-----BEGIN [A-Z ]*PRIVATE KEY-----/iu;

/** Transport validation for a complete printable review; it grants no authority. */
export function projectWorkforceCodeDeliveryReview(value: unknown, roleValue: unknown) {
  const source = record(value, ['version', 'profile', 'configuredRepositoryHash', 'roleProfileHash']);
  const role = record(roleValue, [...ROLE, 'profileHash']);
  if (source.version !== 1 || role.version !== 1 || role.mode !== 'gateway-llm-required') invalid();
  const bindings = array(role.bindings, 128).map(value => {
    const binding = record(value, BINDING);
    return { roleId: identifier(binding.roleId), employeeId: identifier(binding.employeeId),
      providerId: identifier(binding.providerId, true), modelId: identifier(binding.modelId, true),
      maxRequests: integer(binding.maxRequests, 1, 5), maxInputTokens: integer(binding.maxInputTokens, 1, 1_000_000),
      maxOutputTokens: integer(binding.maxOutputTokens, 1, 1_000_000), timeoutMs: integer(binding.timeoutMs, 1000, 3_600_000) };
  }).sort((a, b) => compare(a.roleId, b.roleId));
  if (new Set(bindings.map(binding => binding.roleId)).size !== bindings.length) invalid();
  const canonicalRole = { version: 1, mode: 'gateway-llm-required', profileId: identifier(role.profileId),
    maxTotalRequests: integer(role.maxTotalRequests, bindings.length, bindings.reduce((sum, binding) => sum + binding.maxRequests, 0)),
    maxConcurrentRoles: integer(role.maxConcurrentRoles, 1, Math.min(8, bindings.length)), bindings };
  const roleHash = hash(canonicalRole);
  if (role.profileHash !== roleHash || source.roleProfileHash !== roleHash) invalid();
  const backend = bindings.find(binding => binding.roleId === 'backend-engineer');
  if (!backend || backend.maxRequests < 3 || backend.maxOutputTokens < 16384 || canonicalRole.maxTotalRequests < bindings.length + 2) invalid();
  return Object.freeze({ version: 1, profile: projectWorkforceCodeDeliveryProfile(source.profile),
    configuredRepositoryHash: sha(source.configuredRepositoryHash), roleProfileHash: roleHash });
}

/** Shared exact-file validation for Forge and native-runner transport reviews. */
export function projectWorkforceCodeDeliveryProfile(value: unknown) {
  const p = record(value, [...PROFILE, 'profileHash']);
  const v = record(p.verification, VERIFY), limits = record(p.artifactLimits, ['maxChangedFiles', 'maxFileBytes', 'maxDiffBytes']);
  if (p.version !== 1 || p.mode !== 'forge-owned-worktree-artifact' || p.roleId !== 'backend-engineer'
    || v.workspaceMode !== 'ro' || v.networkAccess !== false || typeof p.baselineRevision !== 'string'
    || !/^[a-f0-9]{40}$/u.test(p.baselineRevision)) invalid();
  const readPaths = paths(p.readPaths, 32), writePaths = paths(p.writePaths, 8);
  const immutableTests = array(v.immutableTests, 8).map(value => {
    const test = record(value, ['path', 'sha256']);
    if (typeof test.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(test.sha256)) invalid();
    return Object.freeze({ path: path(test.path), sha256: test.sha256 });
  }).sort((a, b) => compare(a.path, b.path));
  const writeSet = new Set(writePaths.map(path => path.toLowerCase()));
  if (writePaths.some(path => !readPaths.includes(path))
    || immutableTests.some(test => !readPaths.includes(test.path) || writeSet.has(test.path.toLowerCase()))
    || new Set(immutableTests.map(test => test.path.toLowerCase())).size !== immutableTests.length) invalid();
  const image = text(v.image, 256);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/:-]*@sha256:[a-f0-9]{64}$/u.test(image)
    || typeof v.cpus !== 'number' || !Number.isFinite(v.cpus) || v.cpus < 0.1 || v.cpus > 1) invalid();
  const profile = { version: 1, mode: 'forge-owned-worktree-artifact', profileId: identifier(p.profileId), projectId: identifier(p.projectId),
    baselineRevision: p.baselineRevision, roleId: 'backend-engineer', readPaths: Object.freeze(readPaths), writePaths: Object.freeze(writePaths),
    verification: Object.freeze({ verificationId: identifier(v.verificationId), command: text(v.command, 512), immutableTests: Object.freeze(immutableTests),
      image, workspaceMode: 'ro', networkAccess: false, timeoutMs: integer(v.timeoutMs, 1000, 30000),
      maxMemoryMB: integer(v.maxMemoryMB, 64, 512), maxOutputBytes: integer(v.maxOutputBytes, 1024, 65536),
      pidsLimit: integer(v.pidsLimit, 16, 64), cpus: v.cpus }),
    artifactLimits: Object.freeze({ maxChangedFiles: integer(limits.maxChangedFiles, 1, writePaths.length),
      maxFileBytes: integer(limits.maxFileBytes, 1, 65536), maxDiffBytes: integer(limits.maxDiffBytes, 1, 262144) }) };
  if (p.profileHash !== hash(profile)) invalid();
  return Object.freeze({ ...profile, profileHash: p.profileHash });
}

export function formatWorkforceCodeDeliveryReview(review: ReturnType<typeof projectWorkforceCodeDeliveryReview>) {
  const p = review.profile, v = p.verification, limits = p.artifactLimits;
  const quote = (value: string) => JSON.stringify(value);
  return [
    `Code delivery: ${p.mode}; artifact only; automatic merge: disabled`,
    `Code profile: ${p.profileId}; project: ${p.projectId}; role: ${p.roleId}`,
    `Baseline revision: ${p.baselineRevision}; profile hash: ${p.profileHash}`,
    `Repository configuration hash: ${review.configuredRepositoryHash}; employee profile hash: ${review.roleProfileHash}`,
    'Read files (exact):', ...p.readPaths.map(path => `  ${quote(path)}`),
    'Write files (exact):', ...p.writePaths.map(path => `  ${quote(path)}`),
    `Verification: ${v.verificationId}; command: ${quote(v.command)}`,
    `Container image: ${quote(v.image)}; Workspace: read-only; network: disabled`,
    `Resources: timeout=${v.timeoutMs}ms; memory=${v.maxMemoryMB}MB; output=${v.maxOutputBytes} bytes; processes=${v.pidsLimit}; CPUs=${v.cpus}`,
    'Immutable tests:', ...v.immutableTests.map(test => `  ${quote(test.path)}; SHA256=${test.sha256}`),
    `Artifact limits: changed files<=${limits.maxChangedFiles}; file bytes<=${limits.maxFileBytes}; diff bytes<=${limits.maxDiffBytes}`,
    'This review describes scope; the server separately checks execution readiness and approval validity.',
  ];
}

function invalid(): never { throw new Error('invalid or incomplete Workforce code delivery review'); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== keys.length) invalid();
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) invalid();
    result[key] = descriptor.value;
  }
  return result;
}
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) invalid();
  return Array.from({ length: value.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor)) invalid();
    return descriptor.value;
  });
}
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum
    || /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value) || SECRET.test(value)) invalid();
  return value;
}
function identifier(value: unknown, model = false) {
  const result = text(value, model ? 256 : 128);
  if (!(model ? /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u : /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u).test(result)) invalid();
  return result;
}
function path(value: unknown) {
  const result = text(value, 256).replaceAll('\\', '/');
  if (result.startsWith('/') || /[:*?\[\]{}]/u.test(result)) invalid();
  for (const part of result.split('/')) if (!part || part === '.' || part === '..' || /[. ]$/u.test(part)
    || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part) || PROTECTED.has(part.toLowerCase())
    || /^\.env(?:\.|$)/iu.test(part) || /\.(?:pem|key|pfx|p12|sqlite|db)$/iu.test(part)) invalid();
  return result;
}
function paths(value: unknown, maximum: number) {
  const result = array(value, maximum).map(path).sort();
  if (new Set(result.map(path => path.toLowerCase())).size !== result.length) invalid();
  return result;
}
function integer(value: unknown, minimum: number, maximum: number) {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) invalid();
  return Number(value);
}
function sha(value: unknown) { if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(value)) invalid(); return value; }
function compare(left: string, right: string) { return left < right ? -1 : left > right ? 1 : 0; }
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
}
function hash(value: unknown) { return `sha256:${createHash('sha256').update(stable(value)).digest('hex')}`; }
