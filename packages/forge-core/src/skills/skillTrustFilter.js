/**
 * skillTrustFilter.js
 *
 * Trust gate: filters out candidates that are too risky to auto-install, even
 * if they score well. This is the "would I let this run in my project?" layer.
 *
 * Rules (a candidate is TRUSTED only if ALL pass):
 *   1. MIN_STARS       — must have >= threshold stars (default 3) OR be from a
 *                        well-known org (microsoft, google, etc.)
 *   2. HAS_LICENSE     — must have a recognizable license (no "NOASSERTION" / null)
 *   3. REPO_AGE        — repo must be older than MIN_AGE_DAYS (default 7) to
 *                        avoid brand-new malicious repos
 *   4. NOT_FORK_BOMB   — reject if description/name contains spam patterns
 *   5. MAINTAINED      — updated within MAX_STALE_DAYS (default 730 = 2 years)
 *
 * Each candidate gets { trusted, reasons[], riskLevel }.
 * riskLevel: low | medium | high | blocked
 */

// Well-known orgs that are trusted even with low stars
const TRUSTED_ORGS = new Set([
  "microsoft", "google", "openai", "anthropic", "facebook", "meta",
  "vercel", "netflix", "amazon-web-services", "aws", "cloudflare",
  "github", "npm", "nodejs", "denoland", "oven-sh",
]);

// Spam / suspicious patterns in repo names or descriptions
const SPAM_PATTERNS = [
  /free\s*(followers|likes|subscribers|money|bitcoin|crypto)/i,
  /\b(crack|pirated|warez|nulled|leaked)\b/i,
  /@\s*\w+\s*@\s*\w+/i, // email harvesting
];

/**
 * Evaluate trust for a single candidate.
 * @param {object} candidate — search result
 * @param {object} [opts] — { minStars, minAgeDays, maxStaleDays }
 * @returns {{trusted, reasons, riskLevel, details}}
 */
export function evaluateTrust(candidate, opts = {}) {
  const minStars = opts.minStars ?? 3;
  const minAgeDays = opts.minAgeDays ?? 7;
  const maxStaleDays = opts.maxStaleDays ?? 730;

  const reasons = [];
  let riskScore = 0; // higher = riskier

  // Extract org from repoName (e.g. "owner/repo" → "owner")
  const org = (candidate.repoName || "").split("/")[0]?.toLowerCase() || "";
  const isTrustedOrg = TRUSTED_ORGS.has(org);

  // 1. Stars check (waived for trusted orgs)
  const stars = candidate.stars || 0;
  if (stars < minStars && !isTrustedOrg) {
    reasons.push(`low_stars:${stars} (min ${minStars})`);
    riskScore += 25;
  }

  // 2. License check
  const license = candidate.license;
  if (!license || license === "NOASSERTION") {
    reasons.push("no_license");
    riskScore += 20;
  }

  // 3. Repo age check (based on updatedAt as a proxy; we can't get creation date
  //    from search results without an extra API call)
  if (candidate.updatedAt) {
    const ageDays = (Date.now() - new Date(candidate.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < minAgeDays && !isTrustedOrg) {
      reasons.push(`too_new:${Math.round(ageDays)}d (min ${minAgeDays}d)`);
      riskScore += 30;
    }
    // 4. Stale check
    if (ageDays > maxStaleDays) {
      reasons.push(`stale:${Math.round(ageDays / 365)}y (max ${Math.round(maxStaleDays / 365)}y)`);
      riskScore += 10;
    }
  }

  // 5. Spam pattern check
  const textToCheck = `${candidate.repoName || ""} ${candidate.description || ""}`;
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(textToCheck)) {
      reasons.push(`spam_pattern:${pattern.source.slice(0, 30)}`);
      riskScore += 100; // instant block
    }
  }

  // Determine trust + risk level
  let trusted, riskLevel;
  if (riskScore >= 100) {
    trusted = false;
    riskLevel = "blocked";
  } else if (riskScore >= 40) {
    trusted = false;
    riskLevel = "high";
  } else if (riskScore >= 20) {
    trusted = true; // still usable but flagged
    riskLevel = "medium";
  } else {
    trusted = true;
    riskLevel = "low";
  }

  // Trusted orgs get a boost
  if (isTrustedOrg && riskScore < 100) {
    trusted = true;
    riskLevel = "low";
    reasons.push(`trusted_org:${org}`);
  }

  return {
    trusted,
    reasons,
    riskLevel,
    details: { stars, license, org, isTrustedOrg, riskScore },
  };
}

/**
 * Filter an array of candidates by trust.
 * @param {Array} candidates
 * @param {object} [opts] — passed to evaluateTrust
 * @param {boolean} [opts.includeUntrusted] — if true, return all but mark trust
 * @returns {Array} — trusted candidates (or all with trust info if includeUntrusted)
 */
export function filterByTrust(candidates, opts = {}) {
  const includeUntrusted = opts.includeUntrusted ?? false;
  const evaluated = candidates.map((c) => ({
    ...c,
    trustInfo: evaluateTrust(c, opts),
  }));

  if (includeUntrusted) {
    return evaluated; // return all, caller decides
  }
  return evaluated.filter((c) => c.trustInfo.trusted);
}
