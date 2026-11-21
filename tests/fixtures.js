// Shared Playwright fixtures and helpers for the portfolio test-suite.
//
// Every test that imports `test` from this file automatically fails if the page
// throws an uncaught JavaScript error, logs a console error, or a same-origin
// resource (CSS, JS, image) fails to load.
const base = require('@playwright/test');
const { expect } = base;

const SECTION_IDS = ['home', 'about', 'skills', 'projects', 'experience', 'contact'];
const MOBILE_NAV_BREAKPOINT = 900; // matches @media(max-width:900px) in styles.css

const test = base.test.extend({
  pageIssues: [
    async ({ page, baseURL }, use) => {
      const issues = [];
      page.on('pageerror', (err) => issues.push(`Uncaught JS error: ${err.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') issues.push(`Console error: ${msg.text()}`);
      });
      page.on('requestfailed', (req) => {
        if (req.url().startsWith(baseURL)) issues.push(`Request failed: ${req.url()} (${req.failure()?.errorText})`);
      });
      page.on('response', (res) => {
        if (res.url().startsWith(baseURL) && res.status() >= 400) issues.push(`HTTP ${res.status()}: ${res.url()}`);
      });
      await use(issues);
      expect(issues, 'Page produced JavaScript/console/resource errors').toEqual([]);
    },
    { auto: true },
  ],
});

/** Load the home page and wait for the script to have initialised. */
async function gotoHome(page) {
  await page.goto('/');
  await page.waitForLoadState('load');
  await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'false');
}

/** True when the viewport is narrow enough to use the hamburger menu. */
function usesMobileMenu(page) {
  return page.viewportSize().width <= MOBILE_NAV_BREAKPOINT;
}

/** Open the hamburger menu when on a mobile-sized viewport. */
async function openMenuIfNeeded(page) {
  if (!usesMobileMenu(page)) return;
  await page.locator('#menu-toggle').click();
  await expect(page.locator('#nav-links')).toBeVisible();
}

/** Wait until smooth scrolling has stopped (scrollY stable for several frames). */
async function waitForScrollEnd(page) {
  await page.waitForFunction(() => new Promise((resolve) => {
    let last = window.scrollY;
    let stable = 0;
    const tick = () => {
      if (window.scrollY === last) stable += 1; else { stable = 0; last = window.scrollY; }
      if (stable >= 8) resolve(true); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}

/** Scroll instantly to the bottom in steps so every reveal observer fires. */
async function scrollThroughPage(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, window.innerHeight / 2);
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 40));
    }
  });
}

/** Stub external sites so link tests are fast, offline-safe and don't hit real servers. */
async function stubExternalSites(context) {
  await context.route(/^https:\/\/(www\.)?(github\.com|linkedin\.com)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title>' }),
  );
}

module.exports = {
  test,
  expect,
  SECTION_IDS,
  MOBILE_NAV_BREAKPOINT,
  gotoHome,
  usesMobileMenu,
  openMenuIfNeeded,
  waitForScrollEnd,
  scrollThroughPage,
  stubExternalSites,
};
