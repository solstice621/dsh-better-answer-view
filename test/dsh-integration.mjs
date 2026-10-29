/** Optional real-host test. Start an isolated DSH with scripts/dsh-smoke.mjs first. */
import assert from 'node:assert/strict';
import { access, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const launchUrl = process.env.DSH_SMOKE_URL || (process.env.DSH_SMOKE_URL_FILE ? (await readFile(process.env.DSH_SMOKE_URL_FILE, 'utf8')).trim() : '');
if (!launchUrl) throw new Error('Set DSH_SMOKE_URL or DSH_SMOKE_URL_FILE to the isolated host launch URL.');
const origin = new URL(launchUrl).origin;
const outputDir = process.env.DSH_SMOKE_OUTPUT_DIR;
const rowTitle = process.env.DSH_SMOKE_ROW_TITLE || 'dsh-dev';
let executablePath = process.env.CHROME_PATH;
if (!executablePath && process.platform === 'darwin') {
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  try { await access(chrome); executablePath = chrome; } catch {}
}
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(launchUrl);
  const api = (path, options) => page.evaluate(async ({ path, options }) => {
    const response = await fetch(path, options);
    return { status: response.status, body: await response.json() };
  }, { path, options });
  const probe = await api('/api/web-answer-smoke');
  assert.deepEqual(probe.body.registered, ['render_answer', 'update_answer', 'get_answer']);
  const seed = await api('/api/web-answer-smoke', { method: 'POST' });
  assert.equal(seed.status, 200);
  assert.equal(seed.body.modelCalls, 0);
  const { receipt } = seed.body;
  const query = new URLSearchParams({ sessionId: receipt.sessionId, id: receipt.id });
  const apiPath = `/api/web-answer?${query}`;
  assert.equal((await fetch(origin + apiPath)).status, 401, 'Unauthenticated client must be refused');
  assert.equal(await page.evaluate(() => JSON.stringify(window.__DSH_BOOT__).includes('dsh-better-answer-view')), true);

  async function openFixture() {
    await page.waitForTimeout(600);
    for (const name of ['继续', '稍后配置']) {
      const button = page.getByRole('button', { name, exact: true });
      if (await button.isVisible()) { await button.click(); await page.waitForTimeout(100); }
    }
    if (await page.locator('iframe').count()) return;
    const row = page.getByText(rowTitle, { exact: true }).first();
    if (!(await row.isVisible())) await page.getByText('未分组', { exact: true }).click();
    await row.click();
    await page.frameLocator('iframe').locator('#reward').waitFor();
  }
  await page.reload();
  await openFixture();
  const frame = page.frameLocator('iframe');
  await frame.locator('#reward').waitFor();
  assert.equal(await page.locator('iframe').count(), 1);
  const processRow = page.getByText('1 次工具调用 · 1 条消息', { exact: true });
  assert.equal(await processRow.isVisible(), true, 'The completed turn should keep its collapsed process row');
  assert.equal(await page.locator('iframe').isVisible(), true, 'Web answer must remain visible outside the collapsed process');
  await frame.locator('#reward').fill('180');
  await frame.locator('#reward').dispatchEvent('change');
  await frame.locator('[data-stage="1"]').click();
  const deadline = Date.now() + 10000;
  for (;;) {
    const response = await api(apiPath);
    if (response.body.state.rewardXP === 180 && response.body.state.selectedPhase === 1) break;
    if (Date.now() > deadline) throw new Error('DSH did not persist iframe state');
    await page.waitForTimeout(80);
  }
  await page.reload();
  await openFixture();
  assert.equal(await frame.locator('#reward').inputValue(), '180');
  assert.equal(await frame.locator('[data-stage="1"]').getAttribute('aria-pressed'), 'true');
  await frame.locator('#ask').click();
  const confirm = page.locator('.wa-confirm');
  await confirm.waitFor();
  assert.match(await confirm.innerText(), /180/);
  await confirm.getByRole('button', { name: '取消', exact: true }).click();
  const crossSession = await api(`/api/web-answer?${new URLSearchParams({ sessionId: 'other-session', id: receipt.id })}`);
  assert.equal(crossSession.status, 404);
  assert.deepEqual(errors, []);
  if (outputDir) {
    await mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: join(outputDir, 'dsh-integration.png'), fullPage: true });
    await writeFile(join(outputDir, 'integration-evidence.json'), JSON.stringify({ ...seed.body, errors, checks: ['three registered tools', 'authenticated API', 'client bundle loaded', 'visible outside folded process', 'iframe state save', 'reload recovery', 'follow-up preview cancelled', 'cross-session rejection'] }, null, 2));
  }
  console.log(`PASS: real DSH tools, authenticated API, client module, inline page, state recovery and follow-up preview. Session ${receipt.sessionId}; no model called.`);
} finally {
  await browser.close();
}
