/**
 * githubSkillSearcher.js
 *
 * Searches GitHub for repositories that contain a SKILL.md file (our skill
 * format). Uses the GitHub Search API (code search for `filename:SKILL.md` +
 * keywords). Returns ranked results with repo metadata.
 *
 * Auth: uses a GitHub token from env (GITHUB_TOKEN or GH_TOKEN) for higher
 * rate limits (5000/hr vs 60/hr anonymous). Falls back to anonymous gracefully.
 *
 * Safety: only returns PUBLIC repos. Never clones anything here — that's the
 * installer's job. This module is pure search + metadata.
 */

const GITHUB_API = "https://api.github.com";

/**
 * Search GitHub for skill repos matching keywords.
 * @param {object} options
 * @param {string} options.query — search keywords (e.g. "pdf parser extract")
 * @param {string} [options.category] — optional category filter
 * @param {number} [options.limit=10] — max results
 * @param {string} [options.token] — GitHub token (defaults to env)
 * @returns {Promise<{results, rateLimit, error}>}
 */
export async function searchSkills(options = {}) {
  const query = options.query || "";
  const limit = options.limit || 10;
  const token = options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

  // Build search query: look for SKILL.md files + user keywords
  // GitHub code search: "filename:SKILL.md pdf parser"
  const searchQ = `filename:SKILL.md ${query}`.trim();
  const url = `${GITHUB_API}/search/code?q=${encodeURIComponent(searchQ)}&per_page=${Math.min(limit, 30)}`;

  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "forge-skill-searcher",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let resp;
  try {
    resp = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  } catch (err) {
    return { results: [], error: `GitHub search request failed: ${err.message}` };
  }

  // Rate limit info
  const rateLimit = {
    remaining: parseInt(resp.headers.get("x-ratelimit-remaining") || "0", 10),
    limit: parseInt(resp.headers.get("x-ratelimit-limit") || "0", 10),
    resetAt: resp.headers.get("x-ratelimit-reset") || null,
  };

  if (resp.status === 403 && rateLimit.remaining === 0) {
    return { results: [], rateLimit, error: "GitHub API rate limit exceeded. Set GITHUB_TOKEN for higher limits." };
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    return { results: [], rateLimit, error: `GitHub search failed (HTTP ${resp.status}): ${body.message || resp.statusText}` };
  }

  const data = await resp.json();
  const items = (data.items || []).slice(0, limit);

  // Fetch repo metadata for each result (to get stars, description, etc.)
  const results = [];
  for (const item of items) {
    const repo = item.repository;
    if (!repo) continue;
    results.push({
      repoUrl: repo.html_url,
      repoName: repo.full_name,
      description: repo.description || "",
      stars: repo.stargazers_count || 0,
      language: repo.language || "",
      updatedAt: repo.updated_at || "",
      license: repo.license?.spdx_id || null,
      // Path to the SKILL.md within the repo
      skillPath: item.path,
      // Raw URL to fetch SKILL.md content
      skillManifestUrl: item.html_url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/"),
      score: item.score || 0,
    });
  }

  // Sort by stars (most popular first), then by GitHub search score
  results.sort((a, b) => b.stars - a.stars || b.score - a.score);

  return { results, rateLimit, error: null };
}

/**
 * Fetch the raw SKILL.md content from a GitHub repo.
 * @param {string} rawUrl — raw.githubusercontent.com URL to SKILL.md
 * @param {string} [token]
 * @returns {Promise<{content, error}>}
 */
export async function fetchSkillManifest(rawUrl, token = "") {
  const headers = { "User-Agent": "forge-skill-searcher" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const resp = await fetch(rawUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return { content: null, error: `Failed to fetch manifest (HTTP ${resp.status})` };
    const content = await resp.text();
    return { content, error: null };
  } catch (err) {
    return { content: null, error: err.message };
  }
}

/**
 * Search GitHub repos (not code) for skill-related repos by topic/keywords.
 * This is a BROADER search (repo search instead of code search) — useful when
 * code search rate limits are hit.
 */
export async function searchSkillRepos(options = {}) {
  const query = options.query || "";
  const limit = options.limit || 10;
  const token = options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

  const searchQ = `${query} forge-skill topic:ai-skill`.trim();
  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(searchQ)}&sort=stars&order=desc&per_page=${Math.min(limit, 30)}`;

  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "forge-skill-searcher",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let resp;
  try {
    resp = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  } catch (err) {
    return { results: [], error: err.message };
  }

  if (!resp.ok) {
    return { results: [], error: `Repo search failed (HTTP ${resp.status})` };
  }

  const data = await resp.json();
  const results = (data.items || []).slice(0, limit).map((repo) => ({
    repoUrl: repo.html_url,
    repoName: repo.full_name,
    description: repo.description || "",
    stars: repo.stargazers_count || 0,
    language: repo.language || "",
    updatedAt: repo.updated_at || "",
    license: repo.license?.spdx_id || null,
    defaultBranch: repo.default_branch || "main",
  }));

  return { results, error: null };
}
