const { test, expect, gotoHome, stubExternalSites } = require('./fixtures');

const EMAIL = 'navarra.angelo.aon@gmail.com';
const LINKEDIN = 'https://www.linkedin.com/in/angelo-navarra-936984428/';
const GITHUB = 'https://github.com/geloan448-design';

test.describe('Contact section and links', () => {
  test.beforeEach(async ({ page, context }) => {
    await stubExternalSites(context);
    await gotoHome(page);
  });

  test('all email links use a valid mailto: address', async ({ page }) => {
    const mailtos = await page.locator('a[href^="mailto:"]').evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    expect(mailtos.length).toBeGreaterThanOrEqual(3); // header CTA, contact button, contact card
    for (const href of mailtos) {
      expect(href).toBe(`mailto:${EMAIL}`);
      expect(href.slice(7)).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }
    await expect(page.locator('#contact .contact-method').first()).toContainText(EMAIL);
  });

  test('"Send an Email" button is clickable and does not break the page', async ({ page }) => {
    // Browsers hand mailto: to the OS mail app, which a headless browser cannot
    // open — so we verify the link is usable and the page survives the click.
    const link = page.locator('#contact a.btn-primary[href^="mailto:"]');
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    await expect(link).toBeEnabled();
    await link.click({ noWaitAfter: true }).catch(() => {});
    // Page must still be the portfolio (mailto must not break the site).
    await expect(page.locator('h1')).toBeVisible();
  });

  const socials = [
    { name: 'LinkedIn', href: LINKEDIN },
    { name: 'GitHub', href: GITHUB },
  ];
  for (const s of socials) {
    test(`${s.name} links point to the right profile and open in a new tab`, async ({ page, context }) => {
      const links = page.locator(`a[href="${s.href}"]`);
      await expect(links).toHaveCount(2); // hero socials + contact card
      for (const link of await links.all()) {
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /noreferrer|noopener/);
      }
      const card = page.locator('#contact').locator(`a[href="${s.href}"]`);
      await card.scrollIntoViewIfNeeded();
      const [popup] = await Promise.all([context.waitForEvent('page'), card.click()]);
      await popup.waitForLoadState();
      expect(popup.url()).toBe(s.href);
    });
  }

  test('every external link opens in a new tab safely', async ({ page }) => {
    const ext = await page.locator('a[href^="http"]').evaluateAll((els) => els.map((a) => ({
      href: a.href, target: a.target, rel: a.rel,
    })));
    expect(ext.length).toBeGreaterThan(0);
    for (const l of ext) {
      expect(l.target, l.href).toBe('_blank');
      expect(l.rel, l.href).toMatch(/noreferrer|noopener/);
      expect(l.href.startsWith('https://'), `${l.href} should use https`).toBe(true);
    }
  });

  test('no broken in-page anchors', async ({ page }) => {
    const missing = await page.locator('a[href^="#"]').evaluateAll((els) => els
      .map((a) => a.getAttribute('href'))
      .filter((h) => h !== '#' && !document.getElementById(h.slice(1))));
    expect(missing).toEqual([]);
  });

  test('no broken local resources (CSS, JS, images, SVG sprite refs)', async ({ page, request }) => {
    const urls = await page.evaluate(() => [
      ...[...document.querySelectorAll('link[href]')].map((e) => e.href),
      ...[...document.querySelectorAll('script[src]')].map((e) => e.src),
      ...[...document.querySelectorAll('img[src]')].map((e) => e.src),
    ].filter((u) => u.startsWith(location.origin)));
    for (const u of urls) {
      const res = await request.get(u);
      expect(res.status(), u).toBe(200);
    }
    const missingSymbols = await page.evaluate(() => [...document.querySelectorAll('use')]
      .map((u) => u.getAttribute('href'))
      .filter((h) => !document.querySelector(h)));
    expect(missingSymbols).toEqual([]);
  });
});

// Real network check of external links. Opt-in because it depends on the
// internet and on third-party sites: CHECK_EXTERNAL_LINKS=1 npm test
test.describe('External links (live network)', () => {
  test.skip(!process.env.CHECK_EXTERNAL_LINKS, 'Set CHECK_EXTERNAL_LINKS=1 to check live external URLs');

  test('external URLs respond', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Run once only');
    await gotoHome(page);
    const hrefs = [...new Set(await page.locator('a[href^="http"]').evaluateAll((els) => els.map((a) => a.href)))];
    const results = [];
    for (const href of hrefs) {
      const res = await request.get(href, { maxRedirects: 5, failOnStatusCode: false, timeout: 15000 });
      results.push({ href, status: res.status() });
    }
    await testInfo.attach('external-links.json', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
    // LinkedIn answers automated requests with 999 ("request denied") – not a broken link.
    const broken = results.filter((r) => r.status >= 400 && !(r.href.includes('linkedin.com') && r.status === 999));
    expect(broken).toEqual([]);
  });
});
