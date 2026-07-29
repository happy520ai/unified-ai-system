const DEFAULT_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[role='link']",
  "[contenteditable='true']",
].join(",");

export async function recognizeModules(page, options = {}) {
  const maxModules = options.maxModules ?? 200;
  const modules = await page.$$eval(DEFAULT_SELECTOR, (elements, limit) => elements.slice(0, limit).map((element, index) => {
    const rect = element.getBoundingClientRect();
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role") || tag;
    const text = (element.innerText || element.textContent || element.getAttribute("aria-label") || element.getAttribute("placeholder") || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 160);
    return {
      id: `module-${index + 1}`,
      tag,
      role,
      text,
      name: element.getAttribute("name") || null,
      type: element.getAttribute("type") || null,
      href: element.getAttribute("href") || null,
      visible: rect.width > 0 && rect.height > 0,
    };
  }), maxModules);

  const stats = modules.reduce((acc, item) => {
    acc[item.role] = (acc[item.role] || 0) + 1;
    return acc;
  }, {});

  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    moduleCount: modules.length,
    stats,
    modules,
  };
}
