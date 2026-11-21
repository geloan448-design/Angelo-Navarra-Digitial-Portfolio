const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect, gotoHome, usesMobileMenu } = require('./fixtures');

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Reduced motion makes every [data-reveal] element fully opaque immediately,
// so axe measures real colours instead of half-faded mid-animation text.
test.use({ reducedMotion: 'reduce' });

function formatViolations(violations) {
  return violations.map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} element${v.nodes.length > 1 ? 's' : ''})\n` +
    v.nodes.slice(0, 5).map((n) => `    → ${n.target.join(' ')}${n.failureSummary ? `\n      ${n.failureSummary.replace(/\n/g, '\n      ')}` : ''}`).join('\n'));
}

test.describe('Accessibility – axe-core', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('page has no WCAG 2.2 A/AA violations detected by axe-core', async ({ page }, testInfo) => {
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    await testInfo.attach('axe-results.json', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
    expect(results.violations.length, formatViolations(results.violations).join('\n')).toBe(0);
  });

  test('colour contrast meets WCAG AA', async ({ page }) => {
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(results.violations.length, formatViolations(results.violations).join('\n')).toBe(0);
  });

  test('open mobile menu has no axe violations', async ({ page }) => {
    test.skip(!usesMobileMenu(page), 'Mobile menu only');
    await page.locator('#menu-toggle').click();
    const results = await new AxeBuilder({ page }).include('.site-header').withTags(WCAG_TAGS).analyze();
    expect(results.violations.length, formatViolations(results.violations).join('\n')).toBe(0);
  });

  test('expanded project details have no axe violations', async ({ page }) => {
    await page.locator('#project-details-btn').click();
    const results = await new AxeBuilder({ page }).include('#projects').withTags(WCAG_TAGS).analyze();
    expect(results.violations.length, formatViolations(results.violations).join('\n')).toBe(0);
  });
});

test.describe('Accessibility – keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('every visible link and button can be reached with Tab', async ({ page, browserName }) => {
    // Tag elements with a stable id: their class/aria-current change while the
    // page scrolls (scroll-spy), so outerHTML can't be used to identify them.
    const expected = await page.evaluate(() => [...document.querySelectorAll('a[href], button')]
      .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
      .filter((el) => !el.closest('[hidden]'))
      .map((el, i) => {
        el.dataset.tabProbe = String(i);
        return { id: String(i), label: el.outerHTML.slice(0, 80) };
      }));

    const reached = new Set();
    for (let i = 0; i < expected.length + 5; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.dataset?.tabProbe);
      if (id) reached.add(id);
    }
    const unreachable = expected.filter((e) => !reached.has(e.id)).map((e) => e.label);
    expect(unreachable, `${browserName}: elements not reachable with Tab`).toEqual([]);
  });

  test('focused elements show a visible focus indicator', async ({ page }) => {
    const missing = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const visible = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
        return { el: `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`, visible };
      });
      if (info && !info.visible) missing.push(info.el);
    }
    expect(missing).toEqual([]);
  });

  test('mobile menu can be opened and used with the keyboard', async ({ page }) => {
    test.skip(!usesMobileMenu(page), 'Mobile menu only');
    await page.locator('#menu-toggle').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#nav-links')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#nav-links')).toBeHidden();
    await page.keyboard.press('Enter'); // focus is still on the toggle
    await expect(page.locator('#nav-links')).toBeVisible();
    await page.locator('#nav-links a[href="#about"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#about$/);
    await expect(page.locator('#nav-links')).toBeHidden();
  });
});

test.describe('Accessibility – content structure', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('all images have meaningful alternative text', async ({ page }) => {
    const imgs = await page.locator('img').evaluateAll((els) => els.map((i) => {
      // alt="" is correct for an image inside a button/link that already has its own label.
      const host = i.closest('button[aria-label], a[aria-label]');
      return { src: i.getAttribute('src'), alt: i.getAttribute('alt'), decorativeInLabelledControl: i.getAttribute('alt') === '' && !!host };
    }));
    for (const img of imgs.filter((i) => !i.decorativeInLabelledControl)) {
      expect(img.alt, `${img.src} needs alt text`).not.toBeNull();
      expect(img.alt.trim().length, `${img.src} alt should describe the image`).toBeGreaterThan(5);
      expect(img.alt.toLowerCase()).not.toMatch(/^(image|photo|picture|img)$/);
    }
  });

  test('no unlabelled images are exposed to screen readers', async ({ page }) => {
    // Inspect the real accessibility tree: any image node (including inline
    // SVG icons) a screen reader would announce must have a name.
    const snapshot = await page.locator('body').ariaSnapshot();
    const unnamedImages = snapshot.split('\n').filter((line) => /^\s*- img\s*$/.test(line) || /^\s*- img:?\s*$/.test(line));
    expect(unnamedImages, snapshot).toEqual([]);
    await expect(page.getByRole('img', { name: 'Angelo Navarra wearing his STI College uniform' })).toBeVisible();
  });

  test('page has exactly one h1 and no skipped heading levels', async ({ page }) => {
    const headings = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .map((h) => ({ level: Number(h.tagName[1]), text: h.textContent.trim().replace(/\s+/g, ' ') })));
    expect(headings.filter((h) => h.level === 1)).toHaveLength(1);
    expect(headings[0].level).toBe(1);
    for (let i = 1; i < headings.length; i++) {
      expect(headings[i].level - headings[i - 1].level, `"${headings[i].text}" skips a level after "${headings[i - 1].text}"`).toBeLessThanOrEqual(1);
    }
  });

  test('every page section has a heading or accessible name', async ({ page }) => {
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('main section')]
      .filter((s) => !s.querySelector('h1,h2') && !s.getAttribute('aria-label') && !s.getAttribute('aria-labelledby'))
      .map((s) => s.id || s.className));
    expect(unnamed).toEqual([]);
    for (const id of ['about', 'skills', 'projects', 'experience', 'contact']) {
      await expect(page.locator(`section#${id} h2`)).toHaveCount(1);
    }
  });

  test('page has landmarks and a language attribute', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
  });

  test('all links and buttons have accessible names', async ({ page }) => {
    const nameless = await page.evaluate(() => [...document.querySelectorAll('a[href], button')]
      .filter((el) => !(el.getAttribute('aria-label') || el.textContent).trim())
      .map((el) => el.outerHTML.slice(0, 80)));
    expect(nameless).toEqual([]);
    await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-label', /menu/i);
  });

  test('form controls have accessible labels (if any forms exist)', async ({ page }) => {
    const controls = page.locator('input:not([type=hidden]), select, textarea');
    const count = await controls.count();
    test.info().annotations.push({ type: 'note', description: count ? `${count} form controls found` : 'No form controls on the page – nothing to label' });
    for (const c of await controls.all()) {
      const name = await c.evaluate((el) => el.labels?.[0]?.textContent || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '');
      expect(name.trim(), await c.evaluate((el) => el.outerHTML)).not.toBe('');
    }
  });
});
