const { test, expect, gotoHome, MOBILE_NAV_BREAKPOINT } = require('./fixtures');

const VIEWPORTS = [
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 390, height: 844 },
  { name: 'Small mobile', width: 320, height: 640 },
];

// Layout checks run with reduced motion so every [data-reveal] element is in
// its final position (no mid-animation transforms). Animation behaviour itself
// is covered in interactions.spec.js.
test.use({ reducedMotion: 'reduce' });

/** Elements whose box pokes outside the viewport and isn't clipped by an ancestor. */
function findViewportOverflow() {
  const vw = document.documentElement.clientWidth;
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(hidden|clip)/.test(s.overflowX) || /(hidden|clip)/.test(s.overflow)) {
        const r = p.getBoundingClientRect();
        if (r.left >= -1 && r.right <= vw + 1) return true;
      }
    }
    return false;
  };
  const out = [];
  for (const el of document.querySelectorAll('header *, main *, footer *')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || el.closest('[hidden]')) continue;
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) {
      out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(r.left)}→${Math.round(r.right)} of ${vw}px]`);
    }
  }
  return out;
}

/** Text-bearing block elements whose content is wider/taller than their box without being clipped on purpose. */
function findTextOverflow() {
  const out = [];
  const sel = 'h1,h2,h3,h4,p,li,a,button,strong,small,.metric-title,.metric-detail,.eyebrow,.section-tag,.tech-tags span,.about-pills span,.education-meta span';
  for (const el of document.querySelectorAll(sel)) {
    const s = getComputedStyle(el);
    if (s.display === 'inline' || s.display === 'none' || el.closest('[hidden]')) continue;
    if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) continue;
    if (!el.textContent.trim()) continue;
    if (el.scrollWidth > el.clientWidth + 2) {
      out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 40)}" (${el.scrollWidth}px content in ${el.clientWidth}px box)`);
    }
  }
  return out;
}

/** Interactive elements that are covered by something else at their centre point. */
async function findCoveredControls(page) {
  return page.evaluate(async () => {
    const out = [];
    const controls = [...document.querySelectorAll('main a[href], main button, footer a[href]')]
      .filter((el) => el.offsetParent !== null && !el.closest('[hidden]'));
    for (const el of controls) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      await new Promise((r) => requestAnimationFrame(() => r()));
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit !== el && !el.contains(hit)) {
        out.push(`"${el.textContent.trim().slice(0, 30)}" is covered by ${hit.tagName.toLowerCase()}.${[...hit.classList].join('.')}`);
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    return out;
  });
}

/** Pairs of sibling cards in a grid that overlap each other. */
function findOverlappingCards() {
  const groups = ['.metrics-section > .metrics-card', '#skills-grid > .skill-card:not([hidden])', '.contact-methods > .contact-method', '.hero-actions > .btn', '.skill-tabs > .skill-tab', '.journey-grid > *', '.about-grid > *', '.featured-project > *'];
  const out = [];
  for (const sel of groups) {
    const els = [...document.querySelectorAll(sel)];
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i].getBoundingClientRect();
        const b = els[j].getBoundingClientRect();
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 1 && iy > 1) out.push(`${sel} #${i + 1} overlaps #${j + 1} (${Math.round(ix)}×${Math.round(iy)}px)`);
      }
    }
  }
  return out;
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await gotoHome(page);
    });

    test('has no horizontal scrolling', async ({ page }) => {
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, 'document should not be wider than the viewport').toBeLessThanOrEqual(clientWidth);

      // body has overflow-x:hidden, which can *mask* overflow. Check element boxes too.
      const overflowing = await page.evaluate(findViewportOverflow);
      expect(overflowing, 'elements sticking out past the viewport edge').toEqual([]);
    });

    test('text does not overflow its containers', async ({ page }) => {
      expect(await page.evaluate(findTextOverflow)).toEqual([]);
    });

    test('cards and grid items do not overlap', async ({ page }) => {
      expect(await page.evaluate(findOverlappingCards)).toEqual([]);
    });

    test('buttons and links are not covered by other elements', async ({ page }) => {
      expect(await findCoveredControls(page)).toEqual([]);
    });

    test('images load and display at a sensible size', async ({ page }) => {
      const imgs = await page.locator('img').evaluateAll((els) => els.map((img) => {
        img.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r = img.getBoundingClientRect();
        return { src: img.getAttribute('src'), complete: img.complete, natural: img.naturalWidth, w: r.width, h: r.height, ratio: r.width / r.height, naturalRatio: img.naturalWidth / img.naturalHeight };
      }));
      expect(imgs.length).toBeGreaterThan(0);
      for (const img of imgs) {
        expect(img.complete && img.natural > 0, `${img.src} should load`).toBe(true);
        expect(img.w, `${img.src} should be visible`).toBeGreaterThan(50);
        expect(Math.abs(img.ratio - img.naturalRatio), `${img.src} should not be stretched`).toBeLessThan(0.02);
      }
      await expect(page.locator('.portrait-photo')).toBeVisible();
    });

    test('navigation menu works at this size', async ({ page }) => {
      const toggle = page.locator('#menu-toggle');
      const links = page.locator('#nav-links');
      if (vp.width <= MOBILE_NAV_BREAKPOINT) {
        await expect(toggle).toBeVisible();
        await expect(links).toBeHidden();
        await toggle.click();
        await expect(links).toBeVisible();
        for (const a of await links.locator('a').all()) await expect(a).toBeVisible();
        await links.locator('a[href="#contact"]').click();
        await expect(page.locator('#contact')).toBeInViewport();
      } else {
        await expect(toggle).toBeHidden();
        await expect(links).toBeVisible();
        for (const a of await links.locator('a').all()) await expect(a).toBeVisible();
      }
      await expect(page.locator('.nav-cta')).toBeVisible();
    });

    test('layout uses the expected number of columns', async ({ page }) => {
      const cols = (sel) => page.locator(sel).evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      const expectedSkillCols = vp.width > 900 ? 3 : 2;
      expect(await cols('#skills-grid')).toBe(expectedSkillCols);
      expect(await cols('.featured-project')).toBe(vp.width > 640 ? 2 : 1);
    });

    test('full-page screenshot (attached to report for visual review)', async ({ page }, testInfo) => {
      const shot = await page.screenshot({ fullPage: true });
      await testInfo.attach(`${vp.name}-${vp.width}px.png`, { body: shot, contentType: 'image/png' });
    });
  });
}
