import assert from "node:assert/strict";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const docsRoot = resolve(packageRoot, "../../docs");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function createDocsServer() {
  return createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = normalize(join(docsRoot, relativePath));

    if (!filePath.startsWith(`${docsRoot}${sep}`) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  });
}

async function listen(server) {
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  assert.equal(typeof address, "object");
  return `http://127.0.0.1:${address.port}`;
}

async function launchSmokeBrowser() {
  const attempts = process.env.CI
    ? [{ headless: true }]
    : [{ channel: "chrome", headless: true }, { headless: true }];
  let lastError;

  for (const options of attempts) {
    try {
      return await chromium.launch(options);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function assertPromptLab(page, baseUrl, pathname) {
  const externalRequests = [];
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith(baseUrl) && !url.startsWith("data:")) {
      externalRequests.push(url);
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto(`${baseUrl}/${pathname}`, { waitUntil: "networkidle" });
  const lab = page.locator("[data-prompt-lab]");
  await lab.waitFor();
  await page.locator('[data-prompt-example-profile="planning"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-prompt-copy-evidence]")?.disabled === false,
  );

  const evidenceButton = page.locator("[data-prompt-copy-evidence]");
  const shareButton = page.locator("[data-prompt-share]");
  assert.equal(await evidenceButton.isDisabled(), false);
  assert.equal(await shareButton.isDisabled(), false);
  assert.notEqual((await page.locator("[data-prompt-output]").textContent()).trim(), "");
  assert.match(await page.locator("[data-prompt-status]").textContent(), /none|provider/i);

  await evidenceButton.click();
  const evidence = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  assert.equal(evidence.metadata.providerCalled, false);
  assert.equal(evidence.metadata.credentialRequired, false);
  assert.equal(evidence.metadata.deterministic, true);
  assert.equal(evidence.metadata.originalPreserved, true);
  assert.equal(evidence.profile, "planning");
  assert.equal(typeof evidence.input, "string");
  assert.deepEqual(
    Object.keys(evidence.detectedSignals).sort(),
    ["audience", "constraints", "environment", "evidence", "format", "success"],
  );
  assert.equal(evidence.compiledSections.length, 3);
  assert.equal(
    evidence.compiledSections.every((section) => section.itemCount > 0),
    true,
  );

  await shareButton.click();
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(shareUrl, /#enhance\?/);
  assert.match(shareUrl, /profile=planning/);
  assert.equal(
    externalRequests.some((url) => /openai|anthropic|googleapis|cohere|mistral/i.test(url)),
    false,
  );
}

const server = createDocsServer();
const baseUrl = await listen(server);
const browser = await launchSmokeBrowser();
const context = await browser.newContext({
  permissions: ["clipboard-read", "clipboard-write"],
  viewport: { width: 390, height: 844 },
});

try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    for (const pathname of ["index.html", "index.zh-CN.html"]) {
      const page = await context.newPage();
      try {
        await page.setViewportSize(viewport);
        await assertPromptLab(page, baseUrl, pathname);
      } finally {
        await page.close();
      }
    }
  }
  console.log("Prompt Lab smoke passed for English and Chinese pages at mobile and desktop sizes.");
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
