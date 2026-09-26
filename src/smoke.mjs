import { appendFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const input = (name, fallback = '') => (process.env[name] ?? fallback).trim();

const baseUrl = input('SMOKE_URL');
const paths = input('SMOKE_PATHS', '/')
  .split(/[\n,]/)
  .map((p) => p.trim())
  .filter(Boolean);
const expectText = input('SMOKE_EXPECT_TEXT');
const failOnConsoleErrors = input('SMOKE_FAIL_ON_CONSOLE_ERRORS', 'true') === 'true';
const timeout = Number(input('SMOKE_TIMEOUT', '30000'));
const screenshots = input('SMOKE_SCREENSHOTS', 'true') === 'true';

if (!baseUrl) {
  console.error('::error::The "url" input is required.');
  process.exit(1);
}

async function checkPage(context, path) {
  const url = new URL(path, baseUrl).toString();
  const page = await context.newPage();
  const errors = [];
  if (failOnConsoleErrors) {
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`exception: ${err.message}`));
  }

  const started = Date.now();
  const result = { path, url, status: null, ms: 0, problems: [] };
  try {
    const response = await page.goto(url, { waitUntil: 'load', timeout });
    result.status = response?.status() ?? null;
    if (!response) result.problems.push('no response');
    else if (response.status() >= 400) result.problems.push(`HTTP ${response.status()}`);

    if (expectText && response && response.status() < 400) {
      const body = await page.locator('body').innerText();
      if (!body.includes(expectText)) result.problems.push(`missing text "${expectText}"`);
    }
  } catch (err) {
    result.problems.push(err.message.split('\n')[0]);
  }
  result.ms = Date.now() - started;
  result.problems.push(...errors);

  if (result.problems.length && screenshots) {
    mkdirSync('smoke-results', { recursive: true });
    const name = path.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'root';
    await page.screenshot({ path: `smoke-results/${name}.png`, fullPage: true }).catch(() => {});
  }
  await page.close();
  return result;
}

const browser = await chromium.launch();
const context = await browser.newContext();
const results = [];
for (const path of paths) {
  const result = await checkPage(context, path);
  results.push(result);
  const mark = result.problems.length ? 'FAIL' : 'PASS';
  console.log(`${mark} ${result.url} (${result.status ?? '-'}, ${result.ms} ms)`);
  for (const problem of result.problems) console.log(`     ${problem}`);
}
await browser.close();

const failed = results.filter((r) => r.problems.length);
const passed = results.length - failed.length;

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const summary = [
  `## ${failed.length ? '❌' : '✅'} Smoke test: ${passed}/${results.length} pages passed`,
  '',
  `Target: ${baseUrl}`,
  '',
  '| Page | Status | Time | Result |',
  '| --- | --- | --- | --- |',
  ...results.map(
    (r) =>
      `| \`${cell(r.path)}\` | ${r.status ?? '-'} | ${r.ms} ms | ${
        r.problems.length ? cell(r.problems.join('; ')) : 'OK'
      } |`,
  ),
  '',
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `passed=${passed}\nfailed=${failed.length}\n`);
}
for (const r of failed) console.log(`::error title=Smoke test failed::${r.url}: ${r.problems.join('; ')}`);

process.exit(failed.length ? 1 : 0);
