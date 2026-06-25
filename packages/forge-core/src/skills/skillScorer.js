/**
 * skillScorer.js
 *
 * Multi-dimensional scorer for GitHub skill candidates. Given a search result
 * (from githubSkillSearcher) + the original query, it computes a weighted score
 * across 7 dimensions, returning both the total and a per-dimension breakdown.
 *
 * Dimensions and weights:
 *   matchRelevance   30%  — how well description/name/keywords match the query
 *   stars            20%  — community endorsement (log scale)
 *   recency          15%  — is it actively maintained? (updated recently)
 *   license          10%  — MIT/Apache good, none/GPL-viral caution
 *   hasTests         10%  — quality signal (test files exist)
 *   language         10%  — JS/TS preferred (forge is Node.js)
 *   simplicity        5%  — penalize overly large/complex repos
 *
 * Returns { score (0-100), breakdown, recommendation }
 */

/**
 * @param {object} candidate — a search result from githubSkillSearcher
 * @param {string} query — the original search query
 * @param {object} [manifest] — optional parsed SKILL.md manifest (if fetched)
 * @returns {{score, breakdown, recommendation}}
 */
export function scoreSkill(candidate, query, manifest = null) {
  const breakdown = {};

  // 1. Match relevance (30%) — keyword overlap between query and repo metadata
  breakdown.matchRelevance = scoreRelevance(candidate, query, manifest) * 0.30;

  // 2. Stars (20%) — log scale: 0★=0, 10★=50, 100★=75, 1000★=90, 10000★=100
  breakdown.stars = scoreStars(candidate.stars || 0) * 0.20;

  // 3. Recency (15%) — updated in last 30d=100, 90d=80, 365d=50, 2y=20, older=5
  breakdown.recency = scoreRecency(candidate.updatedAt) * 0.15;

  // 4. License (10%) — MIT/Apache/BSD=100, ISC=90, unknown/none=30, GPL=50
  breakdown.license = scoreLicense(candidate.license) * 0.10;

  // 5. Has tests (10%) — if repo has test files or the manifest mentions tests
  breakdown.hasTests = scoreTests(candidate, manifest) * 0.10;

  // 6. Language (10%) — JS/TS=100, Python=60, other=30, none=20
  breakdown.language = scoreLanguage(candidate.language) * 0.10;

  // 7. Simplicity (5%) — penalize huge repos (unknown size = neutral)
  breakdown.simplicity = scoreSimplicity(candidate) * 0.05;

  // Weighted total
  const score = Math.round(
    Object.values(breakdown).reduce((sum, v) => sum + v, 0)
  );

  // Recommendation bucket
  let recommendation;
  if (score >= 70) recommendation = "highly_recommended";
  else if (score >= 50) recommendation = "recommended";
  else if (score >= 30) recommendation = "acceptable";
  else recommendation = "not_recommended";

  return { score, breakdown, recommendation };
}

/**
 * Score relevance: how well does the candidate match the query?
 * Uses token overlap between query and (name + description + keywords).
 */
function scoreRelevance(candidate, query, manifest) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 50; // neutral if no query

  const candidateText = [
    candidate.repoName || "",
    candidate.description || "",
    manifest?.name || "",
    manifest?.description || "",
    ...(manifest?.keywords || []),
  ].join(" ").toLowerCase();

  const candidateTokens = new Set(tokenize(candidateText));
  let matched = 0;
  for (const t of queryTokens) {
    if (candidateTokens.has(t)) matched++;
  }
  // Partial credit for substring matches (e.g. query "pdf" matches "pdf-parser")
  for (const t of queryTokens) {
    if (!candidateTokens.has(t) && candidateText.includes(t)) matched += 0.5;
  }
  const ratio = matched / queryTokens.length;
  return Math.min(100, Math.round(ratio * 120)); // cap at 100, slight boost for good matches
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[\s\-_/.]+/)
    .filter((t) => t.length >= 2);
}

function scoreStars(stars) {
  if (stars <= 0) return 5;
  // Log scale: log10(stars+1) * 25, capped at 100
  return Math.min(100, Math.round(Math.log10(stars + 1) * 25));
}

function scoreRecency(updatedAt) {
  if (!updatedAt) return 30; // unknown = neutral-low
  const days = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 30) return 100;
  if (days <= 90) return 80;
  if (days <= 180) return 65;
  if (days <= 365) return 50;
  if (days <= 730) return 25;
  return 5;
}

function scoreLicense(license) {
  if (!license || license === "NOASSERTION") return 30;
  const good = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "Unlicense"];
  const caution = ["GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL"];
  if (good.includes(license)) return 100;
  if (caution.includes(license)) return 50;
  return 40; // unknown license
}

function scoreTests(candidate, manifest) {
  // Heuristic: if the search result mentions test files, or the manifest
  // description mentions "test", give credit. In a real implementation we'd
  // fetch the repo file listing, but that's an extra API call.
  const text = `${candidate.description || ""} ${manifest?.description || ""}`.toLowerCase();
  if (text.includes("test") || text.includes("spec") || text.includes("coverage")) return 80;
  return 40; // neutral — we don't know
}

function scoreLanguage(language) {
  if (!language) return 20;
  const lang = language.toLowerCase();
  if (lang === "javascript" || lang === "typescript") return 100;
  if (lang === "python") return 60; // usable but not native to forge
  if (lang === "go" || lang === "rust") return 30;
  return 30;
}

function scoreSimplicity(candidate) {
  // Penalize repos that are likely huge/complex (we don't have exact file count
  // from the search API, but repoName length / description length are weak proxies).
  // Neutral by default; this dimension matters most when we DO have size data.
  return 70; // neutral-positive
}

/**
 * Score and rank an array of candidates.
 * @param {Array} candidates — search results
 * @param {string} query — original query
 * @param {object[]} [manifests] — optional parsed manifests (parallel array)
 * @returns {Array} — candidates sorted by score descending, each with .scoreInfo
 */
export function rankCandidates(candidates, query, manifests = null) {
  const scored = candidates.map((c, i) => {
    const manifest = manifests?.[i] || null;
    const scoreInfo = scoreSkill(c, query, manifest);
    return { ...c, scoreInfo };
  });
  scored.sort((a, b) => b.scoreInfo.score - a.scoreInfo.score);
  return scored;
}
