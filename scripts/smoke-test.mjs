import { chromium } from 'playwright';

const url = new URL('../index.html?smoke=1', import.meta.url).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  const warnings = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.stack || String(err));
  });

  await page.goto(url);
  await page.locator('#runSmoke').click();
  await page.waitForFunction(() => {
    const log = document.querySelector('#smokeOut');
    return log && /(?:^|\n)OK(?:\n|$)/.test(log.textContent || '');
  }, null, { timeout: 10000 });

  const logText = await page.locator('#smokeOut').textContent();
  if (!logText || logText.includes('ERROR:')) {
    throw new Error([logText || 'Smoke test produced no log output', ...pageErrors].join('\n'));
  }

  const invalidDiffWarned = await page.evaluate(async () => {
    const invalidValues = ['not-a-date', '2026-02-30'];
    const seen = new Set();
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (String(args[0] || '').includes('[patapata-clock] Invalid diff value')) {
        seen.add(String(args[1] || ''));
      }
      originalWarn.apply(console, args);
    };
    try {
      for (const value of invalidValues) {
        const clock = document.createElement('patapata-clock');
        clock.setAttribute('format', 'HH:mm:ss');
        clock.setAttribute('diff', value);
        document.body.appendChild(clock);
        await new Promise((resolve) => setTimeout(resolve, 80));
        clock.remove();
      }
      return invalidValues.every((value) => seen.has(value));
    } finally {
      console.warn = originalWarn;
    }
  });

  if (!invalidDiffWarned) {
    throw new Error('Expected invalid diff warning was not emitted');
  }

  console.log(logText.trim());
} finally {
  await browser.close();
}
