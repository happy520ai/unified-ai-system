export function createBrowserExecutor(page) {
  return {
    execute(action) {
      return executeAction(page, action);
    },
  };
}

export async function executeAction(page, action = {}) {
  const type = action.type || action.action || "extractText";
  if (type === "goto") {
    await page.goto(action.url, { waitUntil: "domcontentloaded", timeout: action.timeoutMs ?? 30000 });
    return { type, url: page.url() };
  }
  if (type === "click") {
    await page.click(action.selector, { timeout: action.timeoutMs ?? 10000 });
    return { type, selector: action.selector };
  }
  if (type === "fill") {
    await page.fill(action.selector, String(action.value ?? ""), { timeout: action.timeoutMs ?? 10000 });
    return { type, selector: action.selector };
  }
  if (type === "wait") {
    await page.waitForTimeout(action.ms ?? 1000);
    return { type, ms: action.ms ?? 1000 };
  }
  const text = await page.locator(action.selector || "body").innerText({ timeout: action.timeoutMs ?? 10000 }).catch(() => "");
  return { type: "extractText", selector: action.selector || "body", text };
}
