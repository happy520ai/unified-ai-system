import { lstatSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const GOVERNANCE_PREFIX = "unified-ai-mcp-governance-";
const OWNER_LEASE_FILE = "owner.lease.json";
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 64;

function ownerPidAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return Boolean(error) && error.code === "EPERM"; }
}

function readOwnerPid(dir) {
  try {
    const lease = JSON.parse(readFileSync(join(dir, OWNER_LEASE_FILE), "utf8"));
    return Number.isSafeInteger(lease?.pid) && lease.pid > 0 ? lease.pid : null;
  } catch { return null; }
}

export function sweepGovernanceOrphans({ baseDir, nowMs = Date.now(), probeOwnerAlive = ownerPidAlive }) {
  const removed = [];
  const kept = [];
  let names = [];
  try { names = readdirSync(baseDir); } catch { return { removed, kept }; }
  const candidates = [];
  for (const name of names) {
    if (!name.startsWith(GOVERNANCE_PREFIX)) continue;
    const abs = join(baseDir, name);
    let stats = null;
    try { stats = lstatSync(abs); } catch { continue; }
    if (stats.isSymbolicLink() || !stats.isDirectory()) { kept.push({ name, why: "link_or_nondir" }); continue; }
    const pid = readOwnerPid(abs);
    if (pid !== null) {
      if (probeOwnerAlive(pid)) { kept.push({ name, why: "live_owner" }); continue; }
      candidates.push({ name, abs, ageMs: nowMs - stats.mtimeMs, why: "dead_owner" });
      continue;
    }
    if (nowMs - stats.mtimeMs < ORPHAN_GRACE_MS) { kept.push({ name, why: "unverifiable_within_grace" }); continue; }
    candidates.push({ name, abs, ageMs: nowMs - stats.mtimeMs, why: "no_lease_beyond_grace" });
  }
  candidates.sort((left, right) => right.ageMs - left.ageMs);
  for (const candidate of candidates) {
    if (removed.length >= MAX_PER_RUN) { kept.push({ name: candidate.name, why: "over_cap" }); continue; }
    try {
      rmSync(candidate.abs, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      removed.push({ name: candidate.name, why: candidate.why });
    } catch { kept.push({ name: candidate.name, why: "remove_failed" }); }
  }
  return { removed, kept };
}
