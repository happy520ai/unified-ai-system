// Render docs/security-drill-evidence.html by executing the security regression
// and turning its own stdout into the page. The page is a report, not a transcription:
// The rows are parsed out of the script's own stdout, so the page cannot drift
// from what the tool actually reported; a BREACH verdict or a missing count
// stops the file from being written at all.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const SHA8 = execFileSync("git", ["rev-parse", "--short=8", "HEAD"], { encoding: "utf8" }).trim();
const COMMIT = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const NODE = process.version;
const OSINFO = `${process.platform} ${execFileSync("cmd", ["/c", "ver"], { encoding: "utf8" }).trim().replace(/[\r\n]+/g, "").replace(/^Microsoft Windows \[Version /, "Windows ")}`.replace(/\]$/, "");
const startedAt = new Date().toISOString();

let out = "";
let exitCode = 0;
try {
  out = execFileSync(process.execPath, ["tools/security-attack-regression.mjs"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  out = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  exitCode = error.status ?? 1;
}
const finishedAt = new Date().toISOString();

const lines = out.split("\n").map((l) => l.trim());
const verdicts = [];
for (const line of lines) {
  const m = line.match(/^(DEFENDED|BREACH!!)\s+(.+?)(?:\s+—\s+(.*))?$/);
  if (m) verdicts.push({ ok: m[1] === "DEFENDED", name: m[2].trim(), detail: (m[3] ?? "").trim() });
}
const summary = lines.find((l) => /SECURITY AUDIT:/.test(l)) ?? "(no summary line)";

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const bad = verdicts.filter((v) => !v.ok);
if (exitCode !== 0 || bad.length > 0 || verdicts.length !== 23) {
  console.log(
    `REFUSED: exit=${exitCode} verdicts=${verdicts.length} breaches=${bad.length} summary="${summary}"`,
  );
  if (bad.length) console.log(bad.map((b) => `  BREACH ${b.name}`).join("\n"));
  console.log("No page written.");
  process.exit(1);
}

const rows = verdicts
  .map(
    (v) =>
      `              <tr><th scope="row">${escape(v.name)}</th><td>${escape(v.detail) || "—"}</td><td><span class="pill">defended</span></td></tr>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>23-attack security regression, run and logged: what a self-hosted AI gateway defends | Unified AI System</title>
    <meta
      name="description"
      content="All 23 attacks defended by the repository's own regression against a live local gateway: cross-tenant cache and audit isolation, header forgery, role checks, budget and rate enforcement, instant revocation, secret redaction, and metrics authorization. No credentials, one run."
    />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#081011" />
    <link rel="canonical" href="https://happy520ai.github.io/unified-ai-system/security-drill-evidence.html" />
    <link rel="sitemap" type="application/xml" href="sitemap.xml" />
    <link rel="alternate" type="text/plain" href="llms.txt" title="LLM-readable project summary" />
    <link rel="icon" type="image/png" href="assets/mcp-icon.png" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Unified AI System" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:title" content="23-attack security regression, run and logged" />
    <meta property="og:description" content="Every row below is a line the tool printed, not a capability claimed in prose." />
    <meta property="og:url" content="https://happy520ai.github.io/unified-ai-system/security-drill-evidence.html" />
    <meta property="og:image" content="https://happy520ai.github.io/unified-ai-system/assets/social-preview.png" />
    <meta property="og:image:secure_url" content="https://happy520ai.github.io/unified-ai-system/assets/social-preview.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1280" />
    <meta property="og:image:height" content="640" />
    <meta property="og:image:alt" content="Unified AI System MCP gateway and prompt enhancement preview" />
    <meta property="article:published_time" content="${startedAt}" />
    <meta property="article:modified_time" content="${finishedAt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="23-attack security regression, run and logged" />
    <meta name="twitter:description" content="Cross-tenant isolation, header forgery, role checks, revocation, redaction: 23 probes, all defended." />
    <meta name="twitter:image" content="https://happy520ai.github.io/unified-ai-system/assets/social-preview.png" />
    <meta name="twitter:image:alt" content="Unified AI System MCP gateway and prompt enhancement preview" />
    <link rel="stylesheet" href="site.css" />
    <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "23-attack security regression, run and logged",
  "description": "The repository's security regression executed against a live local gateway instance, with each attack's printed verdict.",
  "datePublished": "${startedAt.slice(0, 10)}",
  "dateModified": "${finishedAt.slice(0, 10)}",
  "author": { "@type": "Organization", "name": "Unified AI System contributors", "url": "https://github.com/happy520ai/unified-ai-system" },
  "mainEntityOfPage": "https://happy520ai.github.io/unified-ai-system/security-drill-evidence.html"
}
    </script>
  </head>
  <body class="article-page">
    <header class="site-header">
      <a class="brand" href="index.html">
        <img src="assets/mcp-icon.png" alt="" width="32" height="32" />
        <span>Unified AI System</span>
      </a>
      <nav>
        <a href="index.html">Home</a>
        <a href="credential-free-evidence.html">Credential-free proof</a>
        <a href="verify-mcp-docker-image.html">Image roster</a>
        <a class="active" href="security-drill-evidence.html" aria-current="page">Security drill</a>
        <a href="https://github.com/happy520ai/unified-ai-system">GitHub</a>
      </nav>
    </header>

    <main>
      <section class="hero">
        <p class="eyebrow">SELF-HOSTED AI GATEWAY / SECURITY EVIDENCE</p>
        <h1>Twenty-three attacks, one run, no credentials</h1>
        <p>
          The repository ships a regression that boots the real gateway HTTP server and
          then attacks it. This page is the output of that run, reformatted - every row
          below is a line the tool printed. The content was generated from the run rather
          than typed, so a row cannot quietly disagree with the tool that produced it.
        </p>
        <p class="hero-meta">
          ${verdicts.length} probes · all defended · exit 0 ·
          commit <code>${SHA8}</code> · ${NODE} · ${escape(OSINFO)} ·
          ${startedAt.slice(0, 19)}Z
        </p>
      </section>

      <section id="method">
        <p class="eyebrow dark">SECTION 01 / WHAT RAN</p>
        <h2>Not a unit test</h2>
        <ul class="method-list">
          <li>It imports the actual application and HTTP server modules and calls <code>listen(0, "127.0.0.1")</code>, so requests travel over a real socket against a real router rather than through a mocked transport.</li>
          <li>State is created in a temporary directory; nothing is read from a developer checkout's configuration and nothing persists after the process exits.</li>
          <li>The gateway runs with the local fake provider. No provider credential exists in the process, so the run costs nothing and sends nothing anywhere.</li>
          <li>Each check asserts the defense, and the tool prints <code>BREACH!!</code> plus a non-zero exit if any check fails - so "all defended" is a conclusion the script reaches on its own.</li>
        </ul>
      </section>

      <section id="results">
        <p class="eyebrow dark">SECTION 02 / THE 23 RESULTS</p>
        <h2>What was attempted, and what came back</h2>
        <table class="roster-table">
          <thead>
            <tr><th scope="col">Attack</th><th scope="col">Observed response</th><th scope="col">Verdict</th></tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
        <p>
          The tool's own final line for this run was <code>${escape(summary)}</code>.
        </p>
        <p>
          Read the list as a shape rather than a scoreboard: the recurring theme is tenant
          and role boundaries (a header carrying someone else's tenant, a viewer-role key on
          an admin surface, a cross-tenant cache or audit filter, a revoked key replaying),
          plus two things small gateways usually get wrong - what lands in the response
          cache when a prompt contains something secret-looking, and whether the metrics
          endpoint leaks material it authenticated everything else to protect.
        </p>
      </section>

      <section id="reproduce">
        <p class="eyebrow dark">SECTION 03 / RUN IT</p>
        <h2>Reproduce on any machine with Node</h2>
        <pre><code>git clone --depth 1 https://github.com/happy520ai/unified-ai-system.git
cd unified-ai-system
pnpm install --frozen-lockfile
node tools/security-attack-regression.mjs</code></pre>
        <p>
          Expect one printed line per attack and the audit line at the end. No API key, no
          Docker, no account.
        </p>
      </section>

      <section id="limits">
        <p class="eyebrow dark">SECTION 04 / BOUNDARY</p>
        <h2>What this does not establish</h2>
        <ul>
          <li>It is not a penetration test by an independent party, and not an audit. It is the project's own checklist, executed.</li>
          <li>It exercises the <strong>source build</strong> on one machine. It does not certify the published container, a deployment, or a cluster, and it says nothing about an installation that has enabled real providers.</li>
          <li>The list is exactly twenty-three checks long because that is what the file contains today. It is not exhaustive: an unlisted weakness is not excluded by a green run here.</li>
          <li>The numbers age. The commit and timestamp above are the version of this claim that was true when it ran; re-run it rather than trusting this page.</li>
        </ul>
      </section>
    </main>

    <footer class="site-footer">
      <p>
        <a href="index.html">Unified AI System</a> - self-hosted AI gateway and agent
        control plane, Apache-2.0.
        Source of this page's data:
        <a href="https://github.com/happy520ai/unified-ai-system/blob/${COMMIT}/tools/security-attack-regression.mjs">tools/security-attack-regression.mjs</a>.
      </p>
    </footer>
    <script src="site.js?v=prompt-lab-9"></script>
  </body>
</html>
`;

writeFileSync("docs/security-drill-evidence.html", html);
console.log(
  `WROTE docs/security-drill-evidence.html | rows=${verdicts.length} | exit=${exitCode} | commit=${COMMIT} | bytes=${html.length}`,
);
