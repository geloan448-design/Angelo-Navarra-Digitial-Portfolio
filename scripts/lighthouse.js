// Run Lighthouse (Performance, Accessibility, Best Practices, SEO) against the
// local site and save HTML + JSON reports to ./reports.
//
//   npm run lighthouse          -> desktop preset
//   npm run lighthouse:mobile   -> mobile preset (throttled, Moto G-class device)
//
// Options: --min=90  minimum category score (0-100) before the run exits with code 1.
// Uses your installed Chrome. Set CHROME_PATH to use a different Chromium binary.
const fs = require('fs');
const path = require('path');
const { start } = require('./serve');

const args = process.argv.slice(2);
const mobile = args.includes('--mobile');
const MIN = Number((args.find((a) => a.startsWith('--min=')) || '--min=90').split('=')[1]);
const OUT = path.resolve(__dirname, '..', 'reports');

// Audits worth calling out for this site (images, JS, metadata, broken resources, console errors, speed).
const WATCH = [
  'first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index',
  'uses-optimized-images', 'modern-image-formats', 'uses-responsive-images', 'image-size-responsive', 'unsized-images',
  'unused-javascript', 'unused-css-rules', 'unminified-css', 'unminified-javascript', 'render-blocking-resources', 'render-blocking-insight',
  'meta-description', 'document-title', 'html-has-lang', 'viewport', 'robots-txt', 'canonical', 'link-text', 'is-crawlable',
  'errors-in-console', 'inspector-issues', 'http-status-code', 'csp-xss', 'font-display', 'image-delivery-insight', 'lcp-discovery-insight',
];

(async () => {
  const [{ default: lighthouse, desktopConfig }, chromeLauncher] = await Promise.all([
    import('lighthouse'),
    import('chrome-launcher'),
  ]);
  const { server, url } = await start(0);
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    chromePath: process.env.CHROME_PATH || undefined,
  });
  let exitCode = 0;
  try {
    const flags = { port: chrome.port, output: ['html', 'json'], logLevel: 'error' };
    const config = mobile ? undefined : desktopConfig;
    const result = await lighthouse(url, flags, config);
    const { lhr, report } = result;
    const label = mobile ? 'mobile' : 'desktop';
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `lighthouse-${label}.html`), report[0]);
    fs.writeFileSync(path.join(OUT, `lighthouse-${label}.json`), report[1]);

    console.log(`\nLighthouse ${lhr.lighthouseVersion} – ${label.toUpperCase()} – ${url}\n`);
    console.log('Category scores');
    for (const cat of Object.values(lhr.categories)) {
      const score = Math.round(cat.score * 100);
      const ok = score >= MIN;
      if (!ok) exitCode = 1;
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${cat.title.padEnd(16)} ${String(score).padStart(3)}  (min ${MIN})`);
    }

    console.log('\nKey metrics');
    for (const id of ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index']) {
      const a = lhr.audits[id];
      if (a) console.log(`  ${a.title.padEnd(26)} ${a.displayValue || ''}`);
    }

    const issues = WATCH.map((id) => lhr.audits[id])
      .filter((a) => a && a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'manual');
    console.log(`\nAudits needing attention (${issues.length})`);
    for (const a of issues) console.log(`  - ${a.title}${a.displayValue ? ` — ${a.displayValue}` : ''}`);

    // Every failed audit across all categories (for the full picture).
    const failed = Object.values(lhr.audits)
      .filter((a) => a.score !== null && a.score < 0.9 && !['notApplicable', 'manual', 'informative'].includes(a.scoreDisplayMode))
      .filter((a) => !WATCH.includes(a.id));
    if (failed.length) {
      console.log('\nOther audits below 90');
      for (const a of failed) console.log(`  - ${a.title}${a.displayValue ? ` — ${a.displayValue}` : ''}`);
    }
    console.log(`\nReports: reports/lighthouse-${label}.html and .json\n`);
  } finally {
    await chrome.kill();
    server.close();
  }
  process.exit(exitCode);
})().catch((err) => {
  console.error(err);
  process.exit(2);
});
