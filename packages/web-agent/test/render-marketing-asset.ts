// Render the single-file marketing sources under docs/assets to the committed PNGs.
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repositoryRoot = resolve(packageRoot, "../..");

const manifestPath = "docs/assets/marketing-assets.json";
const { assets } = JSON.parse(readFileSync(resolve(repositoryRoot, manifestPath), "utf8"));

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

const requested = process.argv.slice(2);
const unknown = requested.filter((name) => !Object.hasOwn(assets, name));
if (unknown.length > 0) {
  console.error(`Unknown asset(s): ${unknown.join(", ")}\nAvailable: ${Object.keys(assets).join(", ")}`);
  process.exit(1);
}
const names = requested.length > 0 ? requested : Object.keys(assets);

mkdirSync(resolve(repositoryRoot, "docs/assets"), { recursive: true });
const browser = await launchBrowser();

try {
  for (const name of names) {
    const asset = assets[name];
    const context = await browser.newContext({
      viewport: { width: asset.width, height: asset.height },
      deviceScaleFactor: asset.scale,
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(resolve(repositoryRoot, asset.source)).href, { waitUntil: "load" });
    await page.screenshot({ path: resolve(repositoryRoot, asset.output), fullPage: false });

    // These pages set `overflow: hidden`, so scrollHeight reports the frame rather
    // than what is drawn: a block pushed past the bottom edge disappears from the
    // PNG without changing a single measurable byte. The bounding boxes of the
    // rendered elements are the only signal that survives the clip.
    const measured = await page.evaluate(() => {
      const canvas = {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      };
      let bottom = 0;
      let right = 0;
      let deepestTag = null;
      for (const element of document.body.querySelectorAll("*")) {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const rect = element.getBoundingClientRect();
        if (rect.height === 0 || rect.width === 0) continue;
        if (rect.bottom > bottom) {
          bottom = rect.bottom;
          deepestTag = `${element.tagName.toLowerCase()}.${element.className}`.slice(0, 40);
        }
        right = Math.max(right, rect.right);
      }
      return { canvas, content: { bottom: Math.round(bottom), right: Math.round(right) }, deepestTag };
    });
    await context.close();

    if (measured.canvas.width !== asset.width || measured.canvas.height !== asset.height) {
      throw new Error(
        `${name}: frame rendered ${measured.canvas.width}x${measured.canvas.height}, `
        + `expected ${asset.width}x${asset.height}`,
      );
    }
    if (measured.content.bottom > asset.height || measured.content.right > asset.width) {
      throw new Error(
        `${name}: ${measured.deepestTag} reaches y=${measured.content.bottom} of a ${asset.height}px frame `
        + `(x=${measured.content.right} of ${asset.width}) - ${measured.content.bottom - asset.height}px is clipped out of the PNG`,
      );
    }
    console.log(
      `Rendered ${asset.output} (${asset.width}x${asset.height} @${asset.scale}x, `
      + `content bottom ${measured.content.bottom})`,
    );
  }
} finally {
  await browser.close();
}
