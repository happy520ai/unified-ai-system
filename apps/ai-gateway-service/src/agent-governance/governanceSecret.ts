/** Governance signing/encryption secret resolution with fail-closed storage. */

import { randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";

const securedSecretPaths = new Set<string>();
const securedDataDirectories = new Set<string>();

export interface GovernanceSecretOptions {
  env?: Record<string, string | undefined>;
  dataDir?: string;
}

export function resolveGovernanceSecret(options: GovernanceSecretOptions = {}): string {
  const env = options.env ?? process.env;
  const dataDir = options.dataDir ?? ".data/agent-governance";
  const fromEnv = env.AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    if (fromEnv.trim().length < 32) {
      throw secretError("Configured Agent Governance HMAC key must contain at least 32 characters.");
    }
  }

  const secretPath = join(dataDir, "secret.key");
  mkdirSync(dirname(secretPath), { recursive: true });
  if (!securedDataDirectories.has(dataDir)) {
    enforceDataDirectoryPermissions(dataDir);
    securedDataDirectories.add(dataDir);
  }
  if (typeof fromEnv === "string" && fromEnv.trim().length >= 32) {
    return fromEnv.trim();
  }
  if (!existsSync(secretPath)) {
    createSecretExclusively(secretPath);
  }
  const existing = readFileSync(secretPath, "utf8").trim();
  if (existing.length < 64) {
    throw secretError("Existing Agent Governance secret is missing, truncated, or invalid; refusing automatic replacement.");
  }
  if (!securedSecretPaths.has(secretPath)) {
    enforceSecretPermissions(secretPath);
    securedSecretPaths.add(secretPath);
  }
  return existing;
}

function enforceDataDirectoryPermissions(dataDir: string): void {
  if (process.platform === "win32") {
    try {
      applyExactWindowsAcl(dataDir);
    } catch (error) {
      throw secretError("Failed to apply a private Windows ACL to the Agent Governance data directory.", error);
    }
    return;
  }
  chmodSync(dataDir, 0o700);
  if ((statSync(dataDir).mode & 0o077) !== 0) {
    throw secretError("Agent Governance data directory permissions are broader than 0700.");
  }
}

function applyExactWindowsAcl(path: string): void {
  const script = [
    "$ErrorActionPreference='Stop'",
    "$root=$env:AGENT_GOVERNANCE_ACL_TARGET",
    "$current=[Security.Principal.WindowsIdentity]::GetCurrent().User",
    "$system=New-Object Security.Principal.SecurityIdentifier('S-1-5-18')",
    "$admins=New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')",
    "$principals=@($current,$system,$admins)",
    "function Set-ExactAcl([string]$target){",
    "$item=Get-Item -LiteralPath $target -Force",
    "if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Reparse points are forbidden in Agent Governance state'}",
    "if($item.PSIsContainer){$acl=New-Object Security.AccessControl.DirectorySecurity;$inherit=[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'}else{$acl=New-Object Security.AccessControl.FileSecurity;$inherit=[Security.AccessControl.InheritanceFlags]::None}",
    "$acl.SetAccessRuleProtection($true,$false)",
    "foreach($principal in $principals){$rule=New-Object Security.AccessControl.FileSystemAccessRule($principal,[Security.AccessControl.FileSystemRights]::FullControl,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow);[void]$acl.AddAccessRule($rule)}",
    "if($item.PSIsContainer){[IO.Directory]::SetAccessControl($target,$acl)}else{[IO.File]::SetAccessControl($target,$acl)}",
    "}",
    "Set-ExactAcl $root",
    "Get-ChildItem -LiteralPath $root -Force -Recurse | ForEach-Object { Set-ExactAcl $_.FullName }",
  ].join(";");
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    windowsHide: true,
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, AGENT_GOVERNANCE_ACL_TARGET: path },
  });
}

function createSecretExclusively(secretPath: string): void {
  const generated = randomBytes(48).toString("hex");
  let descriptor: number | null = null;
  try {
    descriptor = openSync(secretPath, "wx", 0o600);
    writeFileSync(descriptor, generated, { encoding: "utf8" });
    fsyncSync(descriptor);
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function enforceSecretPermissions(secretPath: string): void {
  if (process.platform === "win32") {
    try {
      applyExactWindowsAcl(secretPath);
    } catch (error) {
      throw secretError("Failed to apply a private Windows ACL to the Agent Governance secret.", error);
    }
    return;
  }

  chmodSync(secretPath, 0o600);
  if ((statSync(secretPath).mode & 0o077) !== 0) {
    throw secretError("Agent Governance secret permissions are broader than 0600.");
  }
}

function secretError(message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.name = "GovernanceSecretSecurityError";
  return error;
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "EEXIST");
}
