const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3100/ui?ts=phase372-dom&page=chat&threeMode=god', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const data = await page.evaluate(() => ({
    activePage: Array.from(document.querySelectorAll('[data-page]')).find((n) => n.classList.contains('is-active'))?.getAttribute('data-page') || null,
    activeMode: Array.from(document.querySelectorAll('[data-three-mode]')).find((n) => n.classList.contains('is-active'))?.getAttribute('data-three-mode') || null,
    godPanelActive: document.getElementById('three-mode-panel-god')?.classList.contains('is-active') || false,
    tianshuPanelActive: document.getElementById('three-mode-panel-tianshu')?.classList.contains('is-active') || false,
    normalPanelActive: document.getElementById('three-mode-panel-normal')?.classList.contains('is-active') || false,
    noticeVisible: !!document.getElementById('three-mode-guarded-notice'),
    providerGuideVisible: !!document.getElementById('provider-credentialref-guidance'),
    godText: document.getElementById('three-mode-panel-god')?.innerText?.slice(0, 400) || '',
  }));
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
