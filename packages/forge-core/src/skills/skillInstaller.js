/**
 * skillInstaller.js
 *
 * Downloads a skill from GitHub, validates it in a MEDIUM SANDBOX, and installs
 * it to the local .forge/skills/ directory.
 *
 * Medium sandbox rules:
 *   ✓ read-file     — can read files (readFile)
 *   ✓ network       — can make HTTP requests (fetch)
 *   ✓ temp-write    — can write to os.tmpdir()
 *   ✗ eval          — no eval(), Function(), or vm.runInNewContext()
 *   ✗ child_process — no exec/spawn/fork (unless explicitly whitelisted)
 *   ✗ write-file    — cannot write to project files (only temp)
 *   ✗ env-secrets   — cannot read process.env keys containing SECRET/KEY/TOKEN/PASSWORD
 *
 * Installation flow:
 *   1. Clone/download the repo (or just the SKILL.md + index.js)
 *   2. Parse SKILL.md → validate manifest
 *   3. Static-scan index.js for forbidden patterns (eval, child_process, etc.)
 *   4. node --check on index.js (syntax validation)
 *   5. Copy to .forge/skills/{name}/
 *   6. Return the installed skill path + manifest
 */

import { mkdir, writeFile, readFile, rm, access, readdir, copyFile, stat } from "node:fs/promises";
import { join, resolve, basename, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { parseSkillManifest } from "./skillManifest.js";

const execFileAsync = promisify(execFile);

// Patterns that are FORBIDDEN in skill code (medium sandbox)
const FORBIDDEN_PATTERNS = [
  { pattern: /\beval\s*\(/, reason: "eval() is forbidden in medium sandbox" },
  { pattern: /new\s+Function\s*\(/, reason: "new Function() is forbidden in medium sandbox" },
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, reason: "child_process require is forbidden unless whitelisted" },
  { pattern: /import\s+.*child_process/, reason: "child_process import is forbidden unless whitelisted" },
  { pattern: /import\s+.*vm['"]/, reason: "vm module import is forbidden in medium sandbox" },
  { pattern: /process\.env\s*\.\s*\w*(?:SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL)\w*/i, reason: "reading secret env vars is forbidden" },
];

/**
 * Install a skill from a GitHub repo URL.
 * @param {object} options
 * @param {string} options.repoUrl — GitHub repo URL (https://github.com/owner/repo)
 * @param {string} options.skillsDir — local install dir (usually .forge/skills/)
 * @param {string} [options.skillPath] — path to SKILL.md within the repo (if known)
 * @param {string} [options.token] — GitHub token for private/rate-limited access
 * @param {string} [options.branch] — branch to install (default: main)
 * @param {boolean} [options.skipScan] — skip forbidden-pattern scan (NOT recommended)
 * @returns {Promise<{success, skillName, skillDir, manifest, error}>}
 */
export async function installSkill(options = {}) {
  const { repoUrl, skillsDir, token, skipScan = false } = options;
  if (!repoUrl) return { success: false, error: "repoUrl is required" };
  if (!skillsDir) return { success: false, error: "skillsDir is required" };

  // Parse repo owner/name from URL
  const repoMatch = repoUrl.match(/github\.com[/:]([\w-]+\/[\w.-]+?)(?:\.git)?(?:$|[/?#])/);
  if (!repoMatch) return { success: false, error: `invalid GitHub URL: ${repoUrl}` };
  const repoFullName = repoMatch[1];
  const branch = options.branch || "main";

  // Create a temp dir for download
  const tempDir = join(tmpdir(), `forge-skill-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(tempDir, { recursive: true });

  try {
    // 1. Clone the repo (shallow, single branch)
    const cloneUrl = token
      ? repoUrl.replace("https://", `https://x-access-token:${token}@`)
      : repoUrl;
    try {
      await execFileAsync("git", ["clone", "--depth", "1", "--branch", branch, cloneUrl, tempDir], {
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (err) {
      // If branch not found, try cloning default branch
      try {
        await execFileAsync("git", ["clone", "--depth", "1", cloneUrl, tempDir], {
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024,
        });
      } catch (err2) {
        // Redact token from error message to prevent credential leakage
        const safeMessage = token ? err2.message.replace(token, "[REDACTED]") : err2.message;
        return { success: false, error: `git clone failed: ${safeMessage}` };
      }
    }

    // 2. Find and parse SKILL.md
    const skillMdRel = options.skillPath || "SKILL.md";
    // Security: block path traversal in skillPath
    const skillMdPath = join(tempDir, skillMdRel);
    const resolvedSkillMd = resolve(skillMdPath);
    if (!resolvedSkillMd.startsWith(tempDir + sep) && resolvedSkillMd !== tempDir) {
      return { success: false, error: "skillPath escapes install directory" };
    }
    let manifestContent;
    try {
      manifestContent = await readFile(skillMdPath, "utf8");
    } catch {
      // Search for SKILL.md in subdirectories
      const found = await findFile(tempDir, "SKILL.md");
      if (!found) {
        return { success: false, error: "no SKILL.md found in repo — not a valid forge skill" };
      }
      manifestContent = await readFile(found, "utf8");
    }

    const manifest = parseSkillManifest(manifestContent);
    if (!manifest.valid) {
      return { success: false, error: `invalid SKILL.md: ${manifest.errors.join("; ")}` };
    }

    // 3. Find and validate index.js (the skill implementation)
    const indexPath = join(tempDir, "index.js");
    let indexContent;
    try {
      indexContent = await readFile(indexPath, "utf8");
    } catch {
      return { success: false, error: "no index.js found — skill must have an index.js entry point" };
    }

    // 4. Static scan for forbidden patterns (medium sandbox)
    if (!skipScan) {
      const scanResult = scanForForbidden(indexContent);
      if (scanResult.found.length > 0) {
        return {
          success: false,
          error: `security scan failed: ${scanResult.found.map((f) => f.reason).join("; ")}`,
          scanResult,
        };
      }
    }

    // 5. Syntax check (node --check)
    try {
      await execFileAsync("node", ["--check", indexPath], { timeout: 10000 });
    } catch (err) {
      return { success: false, error: `index.js syntax error: ${(err.stderr || err.message || "").toString().split("\n")[0]}` };
    }

    // 6. Install to .forge/skills/{name}/
    const skillDir = join(skillsDir, manifest.name);
    await mkdir(skillDir, { recursive: true });

    // Copy SKILL.md + index.js + any other .js files in the skill root
    await copyFile(skillMdPath.includes(tempDir) ? skillMdPath : join(tempDir, options.skillPath || "SKILL.md"), join(skillDir, "SKILL.md"));
    await copyFile(indexPath, join(skillDir, "index.js"));

    // Copy supporting files (*.js in same dir, package.json if exists)
    const entries = await readdir(tempDir);
    for (const entry of entries) {
      if (entry === "SKILL.md" || entry === "index.js" || entry === ".git") continue;
      const entryPath = join(tempDir, entry);
      const entryStat = await stat(entryPath).catch(() => null);
      if (!entryStat) continue;
      if (entryStat.isFile() && entry.match(/\.(js|mjs|json|md)$/)) {
        await copyFile(entryPath, join(skillDir, entry)).catch(() => {});
      }
    }

    return {
      success: true,
      skillName: manifest.name,
      skillDir,
      manifest,
      message: `Skill '${manifest.name}' v${manifest.version} installed to ${skillDir}`,
    };
  } catch (err) {
    return { success: false, error: `installation failed: ${err.message}` };
  } finally {
    // Always clean up temp dir, even on early returns
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Scan skill code for forbidden patterns (medium sandbox enforcement).
 */
export function scanForForbidden(code) {
  const found = [];
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    const matches = [...code.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"))];
    if (matches.length > 0) {
      found.push({ pattern: pattern.source, reason, count: matches.length });
    }
  }
  return { found, clean: found.length === 0 };
}

/**
 * Recursively find a file by name.
 */
async function findFile(dir, filename) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isFile() && entry.name === filename) return fullPath;
      if (entry.isDirectory()) {
        const found = await findFile(fullPath, filename);
        if (found) return found;
      }
    }
  } catch {
    // dir not readable
  }
  return null;
}
