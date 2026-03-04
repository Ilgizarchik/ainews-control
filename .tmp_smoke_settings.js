const { chromium } = require('playwright');

(async () => {
  const base = process.env.SMOKE_BASE || 'http://localhost:3000';
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;
  if (!email || !password) throw new Error('SMOKE_EMAIL/SMOKE_PASSWORD required');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[browser console error]', msg.text());
  });

  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole('button', { name: /sign in/i }).click();

  try {
    await page.waitForURL(/\/(publications|content|settings)/, { timeout: 30000 });
  } catch {
    const txt = await page.locator('body').innerText();
    await page.screenshot({ path: '.tmp_smoke_login_failed.png', fullPage: true });
    console.error('LOGIN_PAGE_TEXT_START');
    console.error(txt.slice(0, 1500));
    console.error('LOGIN_PAGE_TEXT_END');
    throw new Error(`Login redirect timeout on ${base}. Current URL: ${page.url()}`);
  }

  await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Settings Center', { timeout: 30000 });

  await page.getByRole('tab', { name: /промпты/i }).click();
  await page.waitForTimeout(2000);

  const promptsEmpty = page.locator('text=Промпты не найдены или недоступны');
  if (await promptsEmpty.count() > 0) {
    await page.screenshot({ path: '.tmp_smoke_prompts_empty.png', fullPage: true });
    throw new Error('Prompts empty state is shown');
  }

  const promptsErrorToast = page.locator('text=Не удалось загрузить промпты');
  if (await promptsErrorToast.count() > 0) {
    await page.screenshot({ path: '.tmp_smoke_prompts_toast_fail.png', fullPage: true });
    throw new Error('Prompts load failure toast is shown');
  }

  await page.getByRole('tab', { name: /источники и сбор/i }).click();
  await page.waitForTimeout(2000);

  const bodyText = await page.locator('body').innerText();
  const m = bodyText.match(/всего источников:\s*(\d+)/i);
  if (!m) {
    await page.screenshot({ path: '.tmp_smoke_sources_parse_failed.png', fullPage: true });
    throw new Error('Could not find sources counter on page');
  }

  const count = Number(m[1]);
  if (!Number.isFinite(count) || count <= 0) {
    await page.screenshot({ path: '.tmp_smoke_sources_zero.png', fullPage: true });
    throw new Error(`Sources count invalid: ${count}`);
  }

  await page.screenshot({ path: '.tmp_smoke_settings_ok.png', fullPage: true });
  console.log(`SMOKE_OK base=${base} sources_count=${count}`);

  await browser.close();
})().catch((e) => {
  console.error('SMOKE_FAIL', e.message);
  process.exit(1);
});
