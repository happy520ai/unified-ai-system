// Does every verbatim quotation on the comparison page still match the file it cites?
//
// Why this exists: that page makes its claims by quoting three other projects "exactly, from the file linked
// after each block", and it invites the reader to check. Nothing checked. Re-reading them by hand on
// 2026-09-29, all four blockquotes and all three licence statements still matched - which is also the moment to
// notice that the match was guaranteed only by someone remembering to look, and a sentence in a README moves
// without anyone telling us. A page that says "if a quotation no longer matches, that is a bug in this page"
// needs a command that knows.
//
// The quotes are read out of the published page rather than restated here. A guard holding its own copy of
// the quotations would keep passing after the page was edited, which is the failure this file exists to
// prevent.
//
//   node tools/check-comparison-quotes.mjs                  # both languages, verdict per line
//   node tools/check-comparison-quotes.mjs --allow-unreadable   # a third-party outage prints, it does not red
//   node tools/check-comparison-quotes.mjs --selftest       # proves the matchers fire on the shapes below
//
// Exit codes: 0 everything read and matched; 4 at least one quotation no longer matches its source (fix the
// page); 5 at least one source could not be read, which is not evidence about the quotation.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PAGE = "docs/self-hosted-ai-gateways-compared.html";
export const PAGE_ZH = "docs/self-hosted-ai-gateways-compared.zh-CN.html";
export const OUR_REPO = "happy520ai/unified-ai-system";
const UA = "UnifiedAISystemQuoteGuard/1.0 (re-reading a quotation this repository published)";
const TIMEOUT_MS = 25000;

// Emphasis and hard-wrap are the page's choice of rendering, not part of the quoted words; the dashes the
// sources use are the ones we did not type. Markdown links are the same thing one level up: a README writes
// `[Smart Caching:](https://wiki/gh-48) Cache responses`, and a quotation that drops the target keeps every
// word of it. Removing the link markup is what lets the words be compared at all - the sentence still has to
// match character for character, so this is not a looser test, it is a test of the right string.
export function foldQuote(s) {
  return String(s)
    .replace(/!?\[([^\]]*)\]\((?:[^)\s]|\([^)]*\))*\)/gu, "$1")
    .replace(/<\/?[a-z][^>]*>/gu, "")
    .replace(/[\u2010-\u2015]/gu, "-")
    .replace(/&amp;/gu, "&")
    .replace(/&#x27;|&rsquo;/gu, "'")
    .replace(/[*_`]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

export function lineMatches(body, line) {
  const text = foldQuote(body);
  const needle = foldQuote(line);
  if (!needle) return { ok: true, empty: true };
  return { ok: text.includes(needle), needle };
}

// Blockquote lines and the file they cite, taken from the page's own markup:
//   <blockquote class="quote"><p>…</p></blockquote> <p class="quote-source"><a href="…/blob/main/README.md">
export function parsePage(html) {
  // Walk the blockquotes and take the citation from the source paragraph that follows, and only that
  // paragraph. A window measured in characters once reached into the next section and compared a repository
  // description against a LICENSE link that happened to be added there - the citation of a quotation has to
  // be the sentence that says where it came from, not whatever markup follows it.
  const out = [];
  const re = /<blockquote[^>]*class="[^"]*quote[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/gu;
  let m;
  while ((m = re.exec(html))) {
    const following = html.slice(m.index + m[0].length, m.index + m[0].length + 400);
    const source = /^\s*<p class="quote-source">([\s\S]*?)<\/p>/u.exec(following);
    const citation = source ? source[1] : "";
    const lines = [...m[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gu)].map((p) =>
      p[1].replace(/<[^>]+>/gu, "").replace(/&#x27;/gu, "'").replace(/&amp;/gu, "&").replace(/\s+/gu, " ").trim());
    const href = /href="(https:\/\/github\.com\/[^"]+)"/u.exec(citation);
    out.push({
      lines: lines.filter(Boolean),
      url: href ? href[1] : null,
      citation: citation.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim(),
    });
  }
  return out;
}

export function parseLicenceClaims(html) {
  // Scoped to the licence section, and the link is taken from the markup rather than the stripped sentence -
  // tags are gone by the time the sentence exists, and a claim whose evidence link was read out of the prose
  // would be a claim with no source.
  const section = /id="licences"[\s\S]*?<\/section>/u.exec(html);
  const scope = section ? section[0] : "";
  if (!scope) return [];
  return [...scope.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gu)]
    .map((m) => m[1])
    .map((inner) => {
      const text = inner.replace(/<[^>]+>/gu, "").replace(/&#x27;/gu, "'").replace(/&quot;/gu, '"').replace(/\s+/gu, " ").trim();
      const link = /href="(https:\/\/github\.com\/[^"]+\/(?:blob\/[^"]+)?LICENSE)"/u.exec(inner);
      // Both languages write the same claim; a detector that only reads English would leave the Chinese page's
      // licence statements unchecked, which the coverage row below would then report as "nothing checked".
      if (!/LICENSE\s*(?:file|文件)|licence file|分段授权|is split/iu.test(text)) return null;
      const expects = [];
      if (/\bMIT\b/u.test(text)) expects.push("MIT License");
      if (/\bApache\b/iu.test(text)) expects.push("Apache License");
      if (/split|Portions of this software|分段授权/iu.test(text)) expects.push("Portions of this software are licensed");
      return { text, expects, url: link ? link[1] : null };
    })
    .filter((c) => c !== null);
}

export function repoPathFromUrl(url) {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/u.exec(String(url ?? ""));
  if (!m) return null;
  return { owner: m[1], repo: m[2], ref: m[3], path: m[4] };
}

export function isTranslated(line) {
  // A Chinese page quotes the same files; if a future translation team renders a quotation into Chinese, the
  // line stops being evidence about the English source and must be reported as not-checked rather than as
  // drift. CJK here is the signal, not an inference about intent.
  return /[㐀-䶿一-鿿぀-ヿ]/u.test(line);
}

async function fetchRaw(target) {
  const url = `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${target.ref}/${target.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow", signal: controller.signal });
    if (res.status !== 200) return { ok: false, why: "HTTP " + res.status + " from raw.githubusercontent.com" };
    return { ok: true, body: await res.text() };
  } catch (e) {
    return { ok: false, why: String(e.name || e.message || "fetch failed") };
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const token = String(process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/vnd.github+json", ...(token ? { authorization: "Bearer " + token } : {}) },
      redirect: "follow", signal: controller.signal,
    });
    if (res.status !== 200) return { ok: false, why: "HTTP " + res.status };
    return { ok: true, body: await res.text() };
  } catch (e) {
    return { ok: false, why: String(e.name || e.message || "fetch failed") };
  } finally {
    clearTimeout(timer);
  }
}

// One of the four blockquotes quotes the repository's About line rather than a file, so its source has no
// /blob/ path. Reading it from the API is the honest check; refusing to look because the shape was unfamiliar
// is how a guard ends up permanently unreadable on the one claim most likely to drift.
export function profileTarget(url) {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/?#]+)\/?$/u.exec(String(url ?? ""));
  return m ? { owner: m[1], repo: m[2] } : null;
}

export async function sourceOf(url) {
  const file = repoPathFromUrl(url);
  if (file) {
    for (const ref of [file.ref, "main", "master"]) {
      const got = await fetchRaw({ ...file, ref });
      if (got.ok) return got;
      if (ref === file.ref) continue;
    }
    return { ok: false, why: "no ref of that file could be read" };
  }
  const profile = profileTarget(url);
  if (!profile) return { ok: false, why: "the citation is not a github file or repository URL", noSource: true };
  const got = await getJson(`https://api.github.com/repos/${profile.owner}/${profile.repo}`);
  if (!got.ok) return { ok: false, why: "repository API: " + got.why };
  let description = null;
  try { description = JSON.parse(got.body).description ?? null; } catch { description = null; }
  return description === null ? { ok: false, why: "the API returned no description field to compare" } : { ok: true, body: description };
}

export async function audit(root, { allowUnreadable = false, pages = [PAGE, PAGE_ZH] } = {}) {
  const results = [];
  for (const page of pages) {
    const html = readFileSync(resolve(root, page), "utf8");
    // How many quotations the page contains is a fact readable from the page. Comparing that with how many the
    // parser found is the only way to notice a parser that has quietly started seeing less - a guard whose
    // denominator shrinks reports "all checked" about the subset it happens to reach.
    const declared = (html.match(/<blockquote[^>]*class="[^"]*quote[^"]*"/gu) || []).length;
    const blocks = parsePage(html);
    if (blocks.length !== declared) {
      results.push({ page, kind: "coverage", state: "unreadable", line: "quotations on the page", why: "the page carries " + declared + " quotations and the parser found " + blocks.length });
    }
    const licences = parseLicenceClaims(html);
    if (licences.length === 0) {
      results.push({ page, kind: "coverage", state: "unreadable", line: "licence claims", why: "the licence section yielded no claim, so nothing about licences was checked" });
    }
    for (const block of blocks) {
      for (const line of block.lines) {
        if (isTranslated(line)) { results.push({ page, kind: "quote", state: "skipped-translated", line }); continue; }
        let url = block.url;
        if (!url && /(?:repository )?description|描述/u.test(block.citation ?? "")) url = "https://github.com/" + OUR_REPO;
        if (!url) { results.push({ page, kind: "quote", state: "unreadable", why: "the citation gives neither a URL nor a stated source", line }); continue; }
        const got = await sourceOf(url);
        if (!got.ok) { results.push({ page, kind: "quote", state: "unreadable", why: got.why, line, url }); continue; }
        const m = lineMatches(got.body, line);
        results.push({ page, kind: "quote", state: m.ok ? "match" : "drift", line, url });
      }
    }
    for (const claim of licences) {
      if (!claim.url) { results.push({ page, kind: "licence", state: "unreadable", why: "the claim names terms but cites no LICENSE URL", line: claim.text.slice(0, 90) }); continue; }
      if (claim.expects.length === 0) { results.push({ page, kind: "licence", state: "unreadable", why: "no licence word could be read out of the sentence", line: claim.text.slice(0, 90) }); continue; }
      const got = await sourceOf(claim.url);
      if (!got.ok) { results.push({ page, kind: "licence", state: "unreadable", why: got.why, line: claim.text.slice(0, 90), url: claim.url }); continue; }
      const head = foldQuote(got.body.slice(0, 4000));
      const missing = claim.expects.filter((needle) => !head.includes(needle.toLowerCase()));
      results.push({ page, kind: "licence", state: missing.length === 0 ? "match" : "drift", line: claim.text.slice(0, 90), url: claim.url, missing });
    }
  }
  return results;
}

function selftest() {
  const arms = {};
  const source = "- **Production-ready gateway** — virtual keys, spend tracking, guardrails\n";
  arms.markdown_emphasis_and_em_dash_are_not_drift = lineMatches(source, "Production-ready gateway - virtual keys, spend tracking, guardrails").ok === true;
  arms.case_and_wrapping_are_not_drift = lineMatches("Smart Caching: Cache Responses From LLMs", "Smart caching: Cache responses from LLMs").ok === true;
  arms.added_entity_is_not_drift = lineMatches("auth & observability", "auth &amp; observability").ok === true;
  arms.a_word_that_disappeared_is_drift = lineMatches("virtual keys, spend tracking", "virtual keys, cost dashboards").ok === false;
  arms.an_empty_line_is_not_evidence = lineMatches("anything", "   ").empty === true;
  const page = [
    '<blockquote class="quote"><p>Alpha sentence.</p><p>Beta sentence.</p></blockquote>',
    '<p class="quote-source"><a href="https://github.com/o/r/blob/main/README.md">README.md</a></p>',
    '<blockquote class="quote"><p>Orphan block.</p></blockquote>',
  ].join("\n");
  const parsed = parsePage(page);
  arms.two_blocks_and_their_links_are_read = parsed.length === 2 && parsed[0].lines.length === 2
    && parsed[0].url === "https://github.com/o/r/blob/main/README.md" && parsed[1].url === null;
  arms.a_block_without_a_source_is_unreadable_not_absent = parsed[1].lines.length === 1 && parsed[1].url === null;
  arms.repo_path_and_ref_are_taken_apart = JSON.stringify(repoPathFromUrl("https://github.com/o/r/blob/main/README.md"))
    === JSON.stringify({ owner: "o", repo: "r", ref: "main", path: "README.md" });
  arms.a_translated_line_is_skipped = isTranslated("生产就绪的网关") === true && isTranslated("Production-ready gateway") === false;
  const lic = parseLicenceClaims('<section id="licences"><ul><li>LinguaLink - its LICENSE file opens with the MIT terms. <a href="https://github.com/o/r/blob/main/LICENSE">LICENSE</a></li></ul></section>');
  arms.licence_claims_are_read_from_the_sentence = lic.length === 1 && lic[0].expects.includes("MIT License");
  const bad = parseLicenceClaims('<section id="licences"><ul><li>Something about a dashboard, no licence claim at all.</li></ul></section>');
  arms.a_bullet_that_makes_no_licence_claim_is_not_counted = bad.length === 0;
  arms.a_markdown_link_target_is_not_part_of_the_words = lineMatches(
    "- [**Smart caching**](https://portkey.wiki/gh-48): Cache responses from LLMs to reduce costs",
    "Smart caching: Cache responses from LLMs to reduce costs").ok === true;
  arms.a_citation_to_a_repository_is_read_from_the_api_shape = JSON.stringify(profileTarget("https://github.com/happy520ai/unified-ai-system"))
    === JSON.stringify({ owner: "happy520ai", repo: "unified-ai-system" });
  arms.a_blob_url_is_not_mistaken_for_a_profile = profileTarget("https://github.com/o/r/blob/main/README.md") === null;
  arms.consecutive_blockquotes_are_all_parsed = parsePage('<blockquote class="quote"><p>One.</p></blockquote><p class="quote-source"><a href="https://github.com/o/r/blob/main/README.md">R</a></p><blockquote class="quote"><p>Two.</p></blockquote><p class="quote-source"><a href="https://github.com/o/r2/blob/main/README.md">R2</a></p>').length === 2;
  arms.a_citation_is_not_read_across_a_section_boundary = parsePage('<blockquote class="quote"><p>One.</p></blockquote></section><section id="licences"><p><a href="https://github.com/o/r/blob/main/LICENSE">LICENSE</a></p></section>')[0].url === null;
  const licSection = parseLicenceClaims('<section id="licences"><ul><li>Portkey - its LICENSE file opens with the MIT terms. <a href="https://github.com/o/r/blob/main/LICENSE">LICENSE</a></li></ul></section>');
  arms.the_evidence_link_survives_tag_stripping = licSection.length === 1 && licSection[0].url === "https://github.com/o/r/blob/main/LICENSE";
  for (const [name, ok] of Object.entries(arms)) console.log(name + "=" + ok);
  const failed = Object.entries(arms).filter(([, v]) => !v);
  if (failed.length) { console.error("SELFTEST FAILED: " + failed.map(([k]) => k).join(", ")); return 2; }
  console.log("QUOTES_SELFTEST_OK");
  return 0;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--selftest")) return selftest();
  const root = resolve(import.meta.dirname, "..");
  const results = await audit(root, { allowUnreadable: argv.includes("--allow-unreadable") });
  const count = (s) => results.filter((r) => r.state === s).length;
  for (const r of results) {
    console.log(r.state.padEnd(18) + r.kind.padEnd(8) + r.page.replace("docs/", "").replace(".html", "").padEnd(36) + String(r.line).slice(0, 80));
    if (r.state === "drift" && r.missing) console.log("  missing from the file: " + r.missing.join(" | "));
    if (r.why) console.log("  why: " + r.why);
  }
  console.log("QUOTE_SUMMARY checked=" + (count("match") + count("drift")) + " match=" + count("match") +
    " drift=" + count("drift") + " unreadable=" + count("unreadable") + " skipped_translated=" + count("skipped-translated"));
  if (count("drift") > 0) {
    console.error("REFUSED: " + count("drift") + " quotation(s) no longer match the file the page cites - fix the page, not the quotation");
    return 4;
  }
  if (count("unreadable") > 0 && !argv.includes("--allow-unreadable")) {
    console.error("REFUSED: " + count("unreadable") + " source(s) could not be read, which says nothing about the quotation");
    return 5;
  }
  if (results.length === 0) {
    console.error("REFUSED: the comparison page yielded no quotations at all, so this run checked nothing");
    return 5;
  }
  console.error("OK: every quotation and licence statement on the comparison page still matches its source");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
