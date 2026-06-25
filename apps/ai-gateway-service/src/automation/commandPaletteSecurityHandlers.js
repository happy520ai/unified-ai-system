import fs from "fs/promises";
import { DATA_DIR, PROVIDERS_CONFIG } from "./commandPaletteConstants.js";

/**
 * Security command handlers for CommandPaletteService.
 * Extracted from commandPaletteService.js to stay under 500 lines.
 */

export async function securityAudit(svc) {
  const issues = [];

  // Check for empty API keys
  const config = await svc._readProvidersConfig();
  const noKey = (config.providers ?? []).filter((p) => !p.apiKey);
  if (noKey.length > 0) {
    issues.push({
      severity: "info",
      message: `${noKey.length} provider(s) have no API key configured.`,
      providers: noKey.map((p) => p.id),
    });
  }

  // Check for hardcoded keys (basic heuristic)
  const hardcodedKeys = (config.providers ?? []).filter(
    (p) => p.apiKey && !p.apiKey.startsWith("${") && p.apiKey.length > 8
  );
  if (hardcodedKeys.length > 0) {
    issues.push({
      severity: "warning",
      message: `${hardcodedKeys.length} provider(s) have hardcoded API keys. Use environment variable references instead.`,
      providers: hardcodedKeys.map((p) => p.id),
    });
  }

  // Check .data directory permissions
  try {
    await fs.access(DATA_DIR);
    issues.push({
      severity: "info",
      message: ".data directory exists and is accessible.",
    });
  } catch {
    issues.push({
      severity: "warning",
      message: ".data directory does not exist. Some features may not work.",
    });
  }

  return {
    issuesFound: issues.length,
    issues,
    auditedAt: new Date().toISOString(),
  };
}

export async function securityScan() {
  const secretPatterns = [
    /sk-[a-zA-Z0-9]{20,}/g,
    /ghp_[a-zA-Z0-9]{36}/g,
    /AKIA[0-9A-Z]{16}/g,
    /Bearer\s+[a-zA-Z0-9\-._~+\/]+=*/g,
  ];

  const findings = [];

  // Scan providers-config.json for leaked secrets
  try {
    const configRaw = await fs.readFile(PROVIDERS_CONFIG, "utf-8");
    for (const pattern of secretPatterns) {
      const matches = configRaw.match(pattern);
      if (matches) {
        findings.push({
          file: "providers-config.json",
          pattern: pattern.source,
          matches: matches.length,
          severity: "critical",
        });
      }
    }
  } catch {
    // File not found, skip
  }

  return {
    scanned: [PROVIDERS_CONFIG],
    findings,
    clean: findings.length === 0,
    scannedAt: new Date().toISOString(),
  };
}

export async function securityStatus(svc) {
  const audit = await securityAudit(svc);
  const scan = await securityScan();

  const criticalCount = [...audit.issues, ...scan.findings]
    .filter((i) => i.severity === "critical").length;
  const warningCount = [...audit.issues, ...scan.findings]
    .filter((i) => i.severity === "warning").length;

  return {
    posture: criticalCount === 0 ? (warningCount === 0 ? "good" : "fair") : "needs_attention",
    critical: criticalCount,
    warnings: warningCount,
    audit,
    scan,
  };
}
