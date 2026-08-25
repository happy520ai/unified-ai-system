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
  const configuredExecutablePath = String(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "",
  ).trim();
  const attempts = [
    ...(configuredExecutablePath
      ? [{ executablePath: configuredExecutablePath, headless: true }]
      : []),
    { channel: "chrome", headless: true },
    { headless: true },
  ];
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

async function routeProviderFreePage(page, baseUrl, externalRequests) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith(baseUrl) && !url.startsWith("data:")) {
      externalRequests.push(url);
      await route.abort();
      return;
    }
    await route.continue();
  });
}

async function assertPromptLab(page, baseUrl, pathname) {
  const externalRequests = [];
  await routeProviderFreePage(page, baseUrl, externalRequests);

  await page.goto(`${baseUrl}/${pathname}`, { waitUntil: "networkidle" });
  const lab = page.locator("[data-prompt-lab]");
  await lab.waitFor();
  await page.locator('[data-prompt-example-profile="planning"]').click();
  await page.waitForFunction(
    () => document.querySelector("[data-prompt-copy-evidence]")?.disabled === false,
  );

  const evidenceButton = page.locator("[data-prompt-copy-evidence]");
  const shareButton = page.locator("[data-prompt-share]");
  const feedbackLink = page.locator("[data-prompt-feedback]");
  assert.equal(await evidenceButton.isDisabled(), false);
  assert.equal(await shareButton.isDisabled(), false);
  assert.equal(await feedbackLink.count(), 1);
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
  assert.equal(evidence.compiledSections.length, 4);
  assert.equal(
    evidence.compiledSections.every((section) => section.itemCount > 0),
    true,
  );

  await shareButton.click();
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  const sharedInput = await page.locator("[data-prompt-input]").inputValue();
  assert.match(shareUrl, /#enhance\?/);
  assert.match(shareUrl, /profile=planning/);

  const sharedPage = await page.context().newPage();
  try {
    await sharedPage.goto(shareUrl, { waitUntil: "networkidle" });
    await sharedPage.locator("[data-prompt-copy-evidence]:not([disabled])").waitFor();
    assert.equal(await sharedPage.locator("[data-prompt-input]").inputValue(), sharedInput);
    assert.equal(await sharedPage.locator("[data-prompt-profile]").inputValue(), "planning");
    assert.match(await sharedPage.locator("[data-prompt-output]").textContent(), /Task|任务/);
  } finally {
    await sharedPage.close();
  }

  await feedbackLink.click().catch(() => {});
  const clipboardPage = await page.context().newPage();
  let feedbackEvidence;
  try {
    await clipboardPage.goto(`${baseUrl}/index.html`, { waitUntil: "domcontentloaded" });
    feedbackEvidence = JSON.parse(
      await clipboardPage.evaluate(() => navigator.clipboard.readText()),
    );
  } finally {
    await clipboardPage.close();
  }
  assert.equal(feedbackEvidence.metadata.providerCalled, false);
  assert.equal(feedbackEvidence.profile, "planning");
  assert.equal(
    externalRequests.some((url) => /issues\/new/.test(url) && /Prompt(?:%20|\+)Lab/.test(url)),
    true,
  );
  assert.equal(
    externalRequests.some((url) => /openai|anthropic|googleapis|cohere|mistral/i.test(url)),
    false,
  );
}

async function assertMultilineUnicodeShareRoundTrip(page, baseUrl) {
  const input = "请比较方案 A&B #1？\n保留 100% + 加号，并检查路径 /api?q=测试#片段。";
  const externalRequests = [];
  await routeProviderFreePage(page, baseUrl, externalRequests);
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle" });

  await page.locator("[data-prompt-input]").fill(input);
  await page.locator("[data-prompt-profile]").selectOption("analysis");
  await page.locator("[data-prompt-language]").selectOption("zh-CN");
  await page.locator("[data-prompt-form]").evaluate((form) => form.requestSubmit());
  await page.locator("[data-prompt-share]:not([disabled])").waitFor();

  await page.locator("[data-prompt-copy-evidence]").click();
  const sourceEvidence = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  assert.equal(sourceEvidence.input, input);
  assert.equal(sourceEvidence.profile, "analysis");
  assert.equal(sourceEvidence.language, "zh-CN");
  assert.equal(sourceEvidence.metadata.providerCalled, false);
  assert.equal(sourceEvidence.metadata.originalPreserved, true);

  await page.locator("[data-prompt-share]").click();
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  for (const encodedMarker of ["%0A", "%26", "%23", "%3F", "%25", "%2B"]) {
    assert.equal(shareUrl.includes(encodedMarker), true, `share URL should contain ${encodedMarker}`);
  }

  const sharedPage = await page.context().newPage();
  try {
    await routeProviderFreePage(sharedPage, baseUrl, externalRequests);
    await sharedPage.goto(shareUrl, { waitUntil: "networkidle" });
    await sharedPage.locator("[data-prompt-copy-evidence]:not([disabled])").waitFor();
    assert.equal(await sharedPage.locator("[data-prompt-input]").inputValue(), input);
    assert.equal(await sharedPage.locator("[data-prompt-profile]").inputValue(), "analysis");
    assert.equal(await sharedPage.locator("[data-prompt-language]").inputValue(), "zh-CN");
    assert.equal((await sharedPage.locator("[data-prompt-output]").textContent()).includes(input), true);

    await sharedPage.locator("[data-prompt-copy-evidence]").click();
    const restoredEvidence = JSON.parse(
      await sharedPage.evaluate(() => navigator.clipboard.readText()),
    );
    assert.equal(restoredEvidence.input, input);
    assert.equal(restoredEvidence.profile, "analysis");
    assert.equal(restoredEvidence.language, "zh-CN");
    assert.equal(restoredEvidence.metadata.providerCalled, false);
    assert.equal(restoredEvidence.metadata.credentialRequired, false);
    assert.equal(restoredEvidence.metadata.originalPreserved, true);
    assert.equal(restoredEvidence.metadata.deterministic, true);
  } finally {
    await sharedPage.close();
  }

  assert.deepEqual(externalRequests, []);
}

const server = createDocsServer();
const baseUrl = await listen(server);
const browser = await launchSmokeBrowser();
const context = await browser.newContext({
  permissions: ["clipboard-read", "clipboard-write"],
  viewport: { width: 390, height: 844 },
});

try {
  const unicodeSharePage = await context.newPage();
  try {
    await unicodeSharePage.setViewportSize({ width: 1440, height: 900 });
    await assertMultilineUnicodeShareRoundTrip(unicodeSharePage, baseUrl);
  } finally {
    await unicodeSharePage.close();
  }

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
  console.log("Prompt Lab smoke passed for multiline Unicode sharing and English/Chinese mobile/desktop pages.");
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolvePromise) => server.close(resolvePromise));
}
