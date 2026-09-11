import { chromium } from "playwright";

export async function launchBrowser(options = {}) {
  if (options.channel !== undefined && !["chrome", "msedge"].includes(options.channel)) throw new Error("WEB_BROWSER_CHANNEL_INVALID");
  return chromium.launch({
    headless: options.headless ?? true,
    slowMo: options.slowMo ?? 0,
    ...(options.channel ? { channel: options.channel } : {}),
    timeout: 10000,
  });
}
