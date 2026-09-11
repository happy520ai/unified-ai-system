import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { AgentToolApprovalReview } from "@unified-ai-system/shared-contracts";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { containsSensitivePublicationText } from "../security/secretSafety.js";

export const GOVERNED_GIT_ENVELOPE_KEY = "__governanceApprovalEnvelope";

const MAX_PR_TITLE_CHARS = 200;
const MAX_PR_BODY_CHARS = 5_000;

export type AgentToolApprovalReviewDraft = Omit<AgentToolApprovalReview, "policyHash">;
export type GovernedGitRunner = (cwd: string, args: string[]) => string;

type GitApprovalEnvelope = {
  schemaVersion: 1;
  toolName: "git_push" | "git_create_pr";
  review: AgentToolApprovalReviewDraft;
  privateExecution?: {
    remoteTarget: string;
    prHeadBranch?: string;
    credentialHelpers?: string[];
    credentialUseHttpPath?: boolean;
  };
};

export function prepareGovernedApprovalParameters(input: {
  toolName: string;
  params: Record<string, unknown>;
  workingDirectory: string;
  gitRunner?: GovernedGitRunner;
}): { params: Record<string, unknown>; review?: AgentToolApprovalReviewDraft } {
  if (input.toolName === "git_push") return prepareGitPush(input.params, input.workingDirectory, input.gitRunner);
  if (input.toolName === "git_create_pr") return prepareGitCreatePr(input.params, input.workingDirectory, input.gitRunner);
  return { params: input.params };
}

export function verifyGovernedGitApprovalParameters(input: {
  toolName: string;
  params: Record<string, unknown>;
  workingDirectory: string;
  gitRunner?: GovernedGitRunner;
}): { ok: true } | { ok: false; code: string; message: string } {
  const stored = readEnvelope(input.params);
  if (!stored || stored.toolName !== input.toolName || stored.review.reviewable !== true) {
    return denial("GIT_APPROVAL_ENVELOPE_REQUIRED", "A valid reviewed Git execution envelope is required.");
  }
  const raw = { ...input.params };
  delete raw[GOVERNED_GIT_ENVELOPE_KEY];
  const current = prepareGovernedApprovalParameters({ ...input, params: raw });
  const currentEnvelope = readEnvelope(current.params);
  if (!currentEnvelope || currentEnvelope.review.reviewable !== true) {
    return denial("GIT_APPROVAL_TARGET_STALE", "The approved Git target can no longer be resolved safely.");
  }
  if (!equalEnvelope(stored, currentEnvelope)) {
    return denial(
      "GIT_APPROVAL_TARGET_STALE",
      "Repository, remote, branch, commit, base, or reviewed content changed after approval.",
    );
  }
  return { ok: true };
}

export function readGovernedGitEnvelope(params: Record<string, unknown>): GitApprovalEnvelope | null {
  return readEnvelope(params);
}

function prepareGitPush(
  params: Record<string, unknown>,
  workingDirectory: string,
  gitRunner?: GovernedGitRunner,
): { params: Record<string, unknown>; review: AgentToolApprovalReviewDraft } {
  const remote = normalizedText(params.remote, "origin");
  const force = params.force === true;
  const setUpstream = params.setUpstream === true;
  try {
    const repository = resolveRepository(workingDirectory, workingDirectory, gitRunner);
    const branch = normalizedText(params.branch, safeGit(repository.root, ["symbolic-ref", "--quiet", "--short", "HEAD"], gitRunner));
    assertGitBranch(repository.root, branch, gitRunner);
    if (force) throw new Error("Governed git_push does not permit force push.");
    if (setUpstream) throw new Error("Governed git_push does not permit implicit upstream mutation.");
    assertPortableRemoteName(remote);
    const [fetchUrl] = requiredSingleGitConfigValue(repository.root, `remote.${remote}.url`, gitRunner);
    const pushUrls = optionalGitConfigValues(repository.root, `remote.${remote}.pushurl`, gitRunner);
    if (pushUrls.length > 1) throw new Error("Multiple Git push targets are not reviewable.");
    const configuredPushUrl = pushUrls[0] ?? fetchUrl;
    const remoteTarget = canonicalExecutionRemote(configuredPushUrl, repository.root);
    assertRemoteResolutionUnchanged(repository.root, remote, remoteTarget, "push", gitRunner);
    const credentialPolicy = resolveCredentialPolicy(repository.root, remoteTarget, gitRunner);
    const commit = fullCommit(repository.root, `refs/heads/${branch}`, gitRunner);
    const review: AgentToolApprovalReviewDraft = {
      schemaVersion: 1,
      reviewable: true,
      effectType: "git:push",
      repository: repository.publicView,
      remote: {
        name: remote,
        target: safeRemoteTarget(remoteTarget),
        urlFingerprint: digest(remoteTarget),
      },
      source: { branch, commit },
      destination: { branch },
      options: { setUpstream: false, forceMode: "none" },
    };
    return withEnvelope(
      { ...params, remote, branch, force: false, setUpstream: false },
      "git_push",
      review,
      { remoteTarget, ...credentialPolicy },
    );
  } catch {
    return withEnvelope(
      { ...params, remote, force, setUpstream },
      "git_push",
      unavailable("git:push", "Git push target could not be resolved into a safe, immutable review envelope."),
    );
  }
}

function prepareGitCreatePr(
  params: Record<string, unknown>,
  workingDirectory: string,
  gitRunner?: GovernedGitRunner,
): { params: Record<string, unknown>; review: AgentToolApprovalReviewDraft } {
  try {
    const requestedDirectory = normalizedText(params.directory, workingDirectory);
    const repository = resolveRepository(workingDirectory, requestedDirectory, gitRunner);
    const remote = "origin";
    const [fetchUrl] = requiredSingleGitConfigValue(repository.root, `remote.${remote}.url`, gitRunner);
    const pushUrls = optionalGitConfigValues(repository.root, `remote.${remote}.pushurl`, gitRunner);
    if (pushUrls.length > 1) throw new Error("Multiple PR push targets are not reviewable.");
    const pushUrl = pushUrls[0] ?? fetchUrl;
    const fetchTarget = canonicalExecutionRemote(fetchUrl, repository.root);
    const pushTarget = canonicalExecutionRemote(pushUrl, repository.root);
    if (fetchTarget !== pushTarget) {
      throw new Error("The PR fetch and push targets do not resolve to the same canonical target.");
    }
    assertRemoteResolutionUnchanged(repository.root, remote, fetchTarget, "fetch", gitRunner);
    assertRemoteResolutionUnchanged(repository.root, remote, pushTarget, "push", gitRunner);
    const credentialPolicy = resolveCredentialPolicy(repository.root, pushTarget, gitRunner);
    const repositorySlug = repositorySlugOf(fetchTarget);
    if (!repositorySlug) throw new Error("The Git remote cannot be represented as a gh repository target.");
    const headBranch = safeGit(repository.root, ["symbolic-ref", "--quiet", "--short", "HEAD"], gitRunner);
    assertGitBranch(repository.root, headBranch, gitRunner);
    const headCommit = fullCommit(repository.root, "HEAD", gitRunner);
    const remoteCommit = remoteHeadCommit(repository.root, fetchTarget, headBranch, gitRunner);
    if (remoteCommit !== headCommit) {
      throw new Error("The remote PR head does not match the reviewed local commit.");
    }
    const baseBranch = normalizedText(params.base, resolveDefaultBase(repository.root, remote, gitRunner));
    assertGitBranch(repository.root, baseBranch, gitRunner);
    const title = requireReviewablePrTitle(params.title);
    const body = requireReviewablePrBody(params.body);
    const draft = params.draft === true;
    const remoteTarget = fetchTarget;
    const prHeadBranch = `agent-governance/pr-${createHash("sha256").update(stableStringify({
      repository: repository.publicView.fingerprint,
      source: headCommit,
      base: baseBranch,
      title,
      body,
      draft,
    })).digest("hex").slice(0, 24)}`;
    assertGitBranch(repository.root, prHeadBranch, gitRunner);
    const existingControlledHead = optionalRemoteHeadCommit(repository.root, remoteTarget, prHeadBranch, gitRunner);
    if (existingControlledHead && existingControlledHead !== headCommit) {
      throw new Error("The controlled PR head already points to a different commit.");
    }
    const review: AgentToolApprovalReviewDraft = {
      schemaVersion: 1,
      reviewable: true,
      effectType: "github:pull-request-create",
      repository: repository.publicView,
      remote: {
        name: remote,
        target: safeRemoteTarget(remoteTarget),
        urlFingerprint: digest(remoteTarget),
      },
      source: { branch: headBranch, commit: headCommit, remoteCommit },
      destination: { branch: baseBranch },
      pullRequest: {
        repository: repositorySlug,
        headBranch: prHeadBranch,
        baseBranch,
        title,
        body,
        bodyHash: digest(body),
        bodyBytes: Buffer.byteLength(body, "utf8"),
        draft,
      },
    };
    return withEnvelope({
      ...params,
      title,
      body,
      base: baseBranch,
      draft,
      directory: repository.root,
    }, "git_create_pr", review, { remoteTarget, prHeadBranch, ...credentialPolicy });
  } catch {
    return withEnvelope(
      { ...params },
      "git_create_pr",
      unavailable(
        "github:pull-request-create",
        "Pull-request target could not be resolved into a safe, immutable review envelope.",
      ),
    );
  }
}

function withEnvelope(
  params: Record<string, unknown>,
  toolName: GitApprovalEnvelope["toolName"],
  review: AgentToolApprovalReviewDraft,
  privateExecution?: GitApprovalEnvelope["privateExecution"],
) {
  const envelope: GitApprovalEnvelope = {
    schemaVersion: 1,
    toolName,
    review,
    ...(privateExecution ? { privateExecution } : {}),
  };
  return {
    params: { ...params, [GOVERNED_GIT_ENVELOPE_KEY]: envelope },
    review,
  };
}

function resolveRepository(boundary: string, requestedDirectory: string, gitRunner?: GovernedGitRunner) {
  const boundaryRoot = canonicalPath(boundary);
  const requested = canonicalPath(isAbsolute(requestedDirectory)
    ? requestedDirectory
    : resolve(boundaryRoot, requestedDirectory));
  if (!inside(boundaryRoot, requested)) throw new Error("Repository target escapes the governed workspace.");
  const root = canonicalPath(safeGit(requested, ["rev-parse", "--show-toplevel"], gitRunner));
  if (!inside(boundaryRoot, root)) throw new Error("Repository root escapes the governed workspace.");
  const commonRaw = safeGit(root, ["rev-parse", "--git-common-dir"], gitRunner);
  const commonDir = canonicalPath(isAbsolute(commonRaw) ? commonRaw : resolve(root, commonRaw));
  return {
    root,
    publicView: {
      displayName: safeLabel(basename(root)),
      fingerprint: digest(`${comparable(root)}\0${comparable(commonDir)}`),
    },
  };
}

function resolveDefaultBase(cwd: string, remote: string, gitRunner?: GovernedGitRunner): string {
  try {
    const remoteHead = safeGit(cwd, ["symbolic-ref", "--quiet", "--short", `refs/remotes/${remote}/HEAD`], gitRunner);
    const prefix = `${remote}/`;
    if (remoteHead.startsWith(prefix)) return remoteHead.slice(prefix.length);
  } catch {
    // Fall through to local conventional branches.
  }
  for (const candidate of ["main", "master"]) {
    try {
      safeGit(cwd, ["rev-parse", "--verify", `refs/heads/${candidate}^{commit}`], gitRunner);
      return candidate;
    } catch {
      // Try the next conventional base.
    }
  }
  throw new Error("No explicit or conventional base branch can be resolved.");
}

function fullCommit(cwd: string, ref: string, gitRunner?: GovernedGitRunner): string {
  const value = safeGit(cwd, ["rev-parse", "--verify", `${ref}^{commit}`], gitRunner).toLowerCase();
  if (!/^[a-f0-9]{40,64}$/u.test(value)) throw new Error("Git returned an invalid commit id.");
  return value;
}

function remoteHeadCommit(cwd: string, remote: string, branch: string, gitRunner?: GovernedGitRunner): string {
  const output = safeGit(cwd, ["ls-remote", "--exit-code", "--heads", remote, `refs/heads/${branch}`], gitRunner);
  const rows = output.split(/\r?\n/u).filter(Boolean);
  if (rows.length !== 1) throw new Error("Remote head is missing or ambiguous.");
  const [commit, ref, ...extra] = rows[0].trim().split(/\s+/u);
  if (extra.length > 0 || ref !== `refs/heads/${branch}` || !/^[a-f0-9]{40,64}$/iu.test(commit)) {
    throw new Error("Remote head response is malformed.");
  }
  return commit.toLowerCase();
}

function optionalRemoteHeadCommit(cwd: string, remote: string, branch: string, gitRunner?: GovernedGitRunner): string | null {
  try {
    return remoteHeadCommit(cwd, remote, branch, gitRunner);
  } catch (error) {
    if (Number((error as { status?: unknown })?.status) === 2) return null;
    throw error;
  }
}

function assertGitBranch(cwd: string, branch: string, gitRunner?: GovernedGitRunner) {
  if (!branch || branch.length > 255) throw new Error("Git branch is invalid.");
  safeGit(cwd, ["check-ref-format", "--branch", branch], gitRunner);
}

function assertPortableRemoteName(remote: string) {
  if (!remote || remote.length > 128 || remote.startsWith("-")
    || /[\u0000-\u0020\u007f;|&$`<>(){}!#\\"']/u.test(remote)) {
    throw new Error("Git remote name is invalid.");
  }
}

function safeGit(cwd: string, args: string[], gitRunner?: GovernedGitRunner): string {
  if (gitRunner) return String(gitRunner(cwd, args)).trim();
  return String(execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 5_000,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  })).trim();
}

function requiredSingleGitConfigValue(cwd: string, key: string, gitRunner?: GovernedGitRunner): [string] {
  const values = optionalGitConfigValues(cwd, key, gitRunner);
  if (values.length !== 1) throw new Error(`Git config ${key} must contain exactly one value.`);
  return [values[0]];
}

function optionalGitConfigValues(cwd: string, key: string, gitRunner?: GovernedGitRunner): string[] {
  try {
    const output = safeGit(cwd, ["config", "--get-all", key], gitRunner);
    if (!output) return [];
    return output.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
  } catch (error) {
    if (Number((error as { status?: unknown })?.status) === 1) return [];
    throw error;
  }
}

function assertRemoteResolutionUnchanged(
  cwd: string,
  remote: string,
  expectedTarget: string,
  mode: "fetch" | "push",
  gitRunner?: GovernedGitRunner,
): void {
  const args = mode === "push"
    ? ["remote", "get-url", "--push", "--all", remote]
    : ["remote", "get-url", "--all", remote];
  const output = safeGit(cwd, args, gitRunner);
  const resolved = output.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
  if (resolved.length !== 1
    || canonicalExecutionRemote(resolved[0], cwd) !== expectedTarget) {
    throw new Error("Git URL rewrite or target ambiguity makes this external effect unreviewable.");
  }
}

function safeRemoteTarget(raw: string): string {
  const slug = repositorySlugOf(raw);
  if (slug) return slug;
  try {
    const parsed = new URL(raw);
    if (!parsed.hostname || !new Set(["https:", "http:", "ssh:", "git:"]).has(parsed.protocol)) {
      throw new Error("local remote");
    }
    return `${parsed.hostname.toLowerCase()}/${basename(parsed.pathname).replace(/\.git$/iu, "")}`;
  } catch {
    return `local/${safeLabel(basename(raw).replace(/\.git$/iu, ""))}`;
  }
}

function canonicalExecutionRemote(raw: string, cwd: string): string {
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error("Git remote target is invalid.");
  if (value.startsWith("file:")) return pathToFileURL(canonicalPath(fileURLToPath(value))).href;
  if (isAbsolute(value) || /^[A-Za-z]:[\\/]/u.test(value)
    || value.startsWith("./") || value.startsWith("../")) {
    return pathToFileURL(canonicalPath(isAbsolute(value) ? value : resolve(cwd, value))).href;
  }
  if (!value.includes("://") && /^(?:[^@/]+@)?[^:/]+:[^\s]+$/u.test(value)) {
    throw new Error("Governed Git SSH/scp remotes are disabled until SSH configuration can be isolated and sealed.");
  }
  const parsed = new URL(value);
  if (!new Set(["https:", "http:"]).has(parsed.protocol) || parsed.password) {
    throw new Error("Git remote protocol or embedded credentials are not allowed for governed push.");
  }
  if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.username) {
    throw new Error("Governed HTTP Git remotes must use a credential helper, not URL userinfo.");
  }
  if (parsed.search) {
    throw new Error("Governed Git remotes must not carry query-string credentials or mutable URL parameters.");
  }
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed.href;
}

const ALLOWED_CREDENTIAL_HELPERS = new Set([
  "manager",
  "manager-core",
  "wincred",
  "osxkeychain",
  "libsecret",
  "cache",
  "store",
  "netrc",
  "oauth",
]);

function resolveCredentialPolicy(
  cwd: string,
  remoteTarget: string,
  gitRunner?: GovernedGitRunner,
): { credentialHelpers: string[]; credentialUseHttpPath: boolean } {
  let parsed: URL;
  try {
    parsed = new URL(remoteTarget);
  } catch {
    return { credentialHelpers: [], credentialUseHttpPath: false };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { credentialHelpers: [], credentialUseHttpPath: false };
  }
  const credentialHelpers = optionalGitConfigValues(cwd, "credential.helper", gitRunner);
  if (credentialHelpers.some((helper) => !isAllowlistedCredentialHelper(helper))) {
    throw new Error("The configured Git credential helper is not safe for isolated governed transport.");
  }
  const useHttpPathValues = optionalGitConfigValues(cwd, "credential.useHttpPath", gitRunner);
  if (useHttpPathValues.length > 1
    || (useHttpPathValues.length === 1 && !/^(?:true|false)$/iu.test(useHttpPathValues[0]))) {
    throw new Error("Git credential.useHttpPath is ambiguous or invalid.");
  }
  return {
    credentialHelpers,
    credentialUseHttpPath: useHttpPathValues[0]?.toLowerCase() === "true",
  };
}

function isAllowlistedCredentialHelper(value: string): boolean {
  const tokens = value.trim().split(/\s+/u);
  if (!ALLOWED_CREDENTIAL_HELPERS.has(tokens[0]?.toLowerCase())) return false;
  return tokens.slice(1).every((token) => /^--?[A-Za-z0-9][A-Za-z0-9._=-]{0,127}$/u.test(token));
}

function repositorySlugOf(raw: string): string | null {
  const scp = raw.includes("://") ? null : raw.match(/^(?:[^@/]+@)?([^:/]+):([^\s]+)$/u);
  if (scp) return normalizeRepositorySlug(scp[1], scp[2]);
  try {
    const parsed = new URL(raw);
    if (!new Set(["https:", "http:", "ssh:", "git:"]).has(parsed.protocol)) return null;
    return normalizeRepositorySlug(parsed.hostname, parsed.pathname);
  } catch {
    return null;
  }
}

function normalizeRepositorySlug(host: string, pathname: string): string | null {
  const parts = pathname.replace(/^\/+|\/+$/gu, "").replace(/\.git$/iu, "").split("/").filter(Boolean);
  if (!host || parts.length < 2 || parts.some((part) => !/^[A-Za-z0-9_.-]+$/u.test(part))) return null;
  const ownerRepo = parts.slice(-2).join("/");
  return host.toLowerCase() === "github.com" ? ownerRepo : `${host.toLowerCase()}/${ownerRepo}`;
}

function canonicalPath(value: string): string {
  return realpathSync.native(resolve(value));
}

function inside(root: string, candidate: string): boolean {
  const rel = relative(comparable(root), comparable(candidate));
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function comparable(value: string): string {
  const resolved = resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function normalizedText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback.trim();
}

function requireReviewablePrTitle(value: unknown): string {
  if (typeof value !== "string") throw new Error("A non-empty PR title is required.");
  const title = value.trim();
  if (!title || title.length > MAX_PR_TITLE_CHARS || /[\u0000-\u001f\u007f]/u.test(title)
    || !isSafePublicText(title)) {
    throw new Error("The PR title is not safe for complete operator review.");
  }
  return title;
}

function requireReviewablePrBody(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > MAX_PR_BODY_CHARS
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
    || !isSafePublicText(value)) {
    throw new Error("The PR body is not safe for complete operator review.");
  }
  return value;
}

function isSafePublicText(value: string): boolean {
  return !containsSensitivePublicationText(value);
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function safeLabel(value: string): string {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/gu, "").trim();
  return (normalized || "repository").slice(0, 128);
}

function unavailable(effectType: string, unavailableReason: string): AgentToolApprovalReviewDraft {
  return { schemaVersion: 1, reviewable: false, effectType, unavailableReason };
}

function readEnvelope(params: Record<string, unknown>): GitApprovalEnvelope | null {
  const value = params?.[GOVERNED_GIT_ENVELOPE_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Partial<GitApprovalEnvelope>;
  if (envelope.schemaVersion !== 1
    || (envelope.toolName !== "git_push" && envelope.toolName !== "git_create_pr")
    || !envelope.review || typeof envelope.review !== "object") return null;
  return envelope as GitApprovalEnvelope;
}

function equalEnvelope(left: GitApprovalEnvelope, right: GitApprovalEnvelope): boolean {
  return createHash("sha256").update(stableStringify(left)).digest("hex")
    === createHash("sha256").update(stableStringify(right)).digest("hex");
}

function denial(code: string, message: string) {
  return { ok: false as const, code, message };
}
