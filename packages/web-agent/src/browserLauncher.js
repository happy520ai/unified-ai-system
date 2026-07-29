import { chromium } from "playwright";

export async function launchBrowser(options = {}) {
  return chromium.launch({
    headless: options.headless ?? true,
    slowMo: options.slowMo ?? 0,
  });
}
