const { test, expect, gotoHome, scrollThroughPage } = require('./fixtures');

const opacity = (loc) => loc.evaluate((el) => Number(getComputedStyle(el).opacity));
const supportsParallax = (page) => page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);

test.describe('Reveal animations', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('off-screen sections start hidden and reveal when scrolled into view', async ({ page }) => {
    const target = page.locator('.contact-panel[data-reveal]');
    await expect(target).not.toHaveClass(/\bvisible\b/);
    expect(await opacity(target)).toBe(0);

    await target.scrollIntoViewIfNeeded();
    await expect(target).toHaveClass(/\bvisible\b/);
    await expect.poll(() => opacity(target), { timeout: 3000 }).toBe(1);
  });

  test('every [data-reveal] element becomes visible after scrolling the whole page', async ({ page }) => {
    await scrollThroughPage(page);
    const notRevealed = () => page.locator('[data-reveal]:not(.visible)').evaluateAll((els) =>
      els.map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`));
    await expect.poll(notRevealed, { message: 'elements never revealed' }).toEqual([]);
  });

  test('hero content is visible immediately on load', async ({ page }) => {
    await expect(page.locator('.hero-copy')).toHaveClass(/\bvisible\b/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('animations do not cause layout shift or horizontal overflow', async ({ page }) => {
    await page.evaluate(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await scrollThroughPage(page);
    await page.waitForTimeout(1000); // let the 0.8s reveal transitions finish

    const cls = await page.evaluate(() => window.__cls);
    expect(cls, 'Cumulative Layout Shift while scrolling').toBeLessThan(0.1);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw).toBeLessThanOrEqual(cw);
  });
});

test.describe('Portrait parallax', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('portrait follows the mouse on devices with a fine pointer', async ({ page }) => {
    test.skip(!(await supportsParallax(page)), 'Parallax is intentionally disabled on touch devices');
    const stage = page.locator('#portrait-stage');
    const box = await stage.boundingBox();

    await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.95);
    await expect.poll(() => stage.evaluate((el) => el.style.getPropertyValue('--mouse-x'))).not.toBe('');
    const x = parseFloat(await stage.evaluate((el) => el.style.getPropertyValue('--mouse-x')));
    expect(x).toBeGreaterThan(5);
    expect(x).toBeLessThanOrEqual(7.5); // max offset is ±7.5px (0.5 × 15)
    await expect.poll(() => page.locator('.portrait-photo').evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');

    // Moving away resets the portrait.
    await page.mouse.move(2, 2);
    await expect.poll(() => stage.evaluate((el) => el.style.getPropertyValue('--mouse-x'))).toBe('0px');
  });

  test('parallax stays off on touch devices', async ({ page }) => {
    test.skip(await supportsParallax(page), 'Only relevant on touch / coarse-pointer devices');
    const stage = page.locator('#portrait-stage');
    const box = await stage.boundingBox();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5);
    expect(await stage.evaluate((el) => el.style.getPropertyValue('--mouse-x'))).toBe('');
  });

  test('parallax does not move the portrait outside its frame', async ({ page }) => {
    test.skip(!(await supportsParallax(page)), 'Parallax is intentionally disabled on touch devices');
    const stage = page.locator('#portrait-stage');
    const box = await stage.boundingBox();
    const before = await page.evaluate(() => document.documentElement.scrollWidth);
    for (const [fx, fy] of [[0.01, 0.01], [0.99, 0.01], [0.99, 0.99], [0.01, 0.99]]) {
      await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(before);
  });
});

test.describe('Reduced-motion preference', () => {
  test.use({ reducedMotion: 'reduce' });

  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('all reveal content is visible immediately without scrolling', async ({ page }) => {
    await expect(page.locator('[data-reveal]:not(.visible)')).toHaveCount(0);
    expect(await opacity(page.locator('.contact-panel'))).toBe(1);
  });

  test('CSS animations and transitions are disabled', async ({ page }) => {
    const styles = await page.evaluate(() => ['.orbit-two', '.network-map', '.scroll-track span', '.project-node', '.skill-card', '.btn']
      .map((sel) => document.querySelector(sel))
      .filter(Boolean)
      .map((el) => ({ anim: getComputedStyle(el).animationName, dur: getComputedStyle(el).transitionDuration })));
    for (const s of styles) {
      expect(s.anim).toBe('none');
      expect(s.dur.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
    }
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  });

  test('portrait parallax is disabled', async ({ page }) => {
    const stage = page.locator('#portrait-stage');
    const box = await stage.boundingBox();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.9);
    expect(await stage.evaluate((el) => el.style.getPropertyValue('--mouse-x'))).toBe('');
    expect(await page.locator('.portrait-photo').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  });
});
