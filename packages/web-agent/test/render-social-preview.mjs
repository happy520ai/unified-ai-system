import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(packageRoot, "../..");
const sourcePath = resolve(repositoryRoot, "docs/assets/social-preview-source.html");
const outputPath = resolve(repositoryRoot, "docs/assets/social-preview.png");

async function launchBrowser() {
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

await mkdir(dirname(outputPath), { recursive: true });
const browser = await launchBrowser();

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  await page.goto(pathToFileURL(sourcePath).href, { waitUntil: "load" });
  await page.screenshot({ path: outputPath, fullPage: false });

  const dimensions = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth,
  }));

  if (dimensions.width !== 1280 || dimensions.height !== 640) {
    throw new Error(`Unexpected preview dimensions: ${dimensions.width}x${dimensions.height}`);
  }

  console.log(`Rendered ${outputPath} (${dimensions.width}x${dimensions.height})`);
} finally {
  await browser.close();
}
