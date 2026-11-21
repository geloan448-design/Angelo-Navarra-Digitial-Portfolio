const {
  test, expect, SECTION_IDS, gotoHome, usesMobileMenu, openMenuIfNeeded, waitForScrollEnd,
} = require('./fixtures');

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test('main navigation contains a link for every page section', async ({ page }) => {
    const hrefs = await page.locator('#nav-links .nav-link').evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(SECTION_IDS.map((id) => `#${id}`));
    for (const id of SECTION_IDS) {
      await expect(page.locator(`section#${id}`), `section #${id} should exist`).toHaveCount(1);
    }
  });

  for (const id of SECTION_IDS) {
    test(`clicking the "${id}" nav link scrolls to the #${id} section`, async ({ page }) => {
      await openMenuIfNeeded(page);
      await page.locator(`#nav-links a[href="#${id}"]`).click();
      await waitForScrollEnd(page);

      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      const section = page.locator(`section#${id}`);
      await expect(section).toBeInViewport();

      // The sticky header must not hide the section's top (unless the page
      // cannot scroll any further, e.g. the last section).
      const { top, headerBottom, atBottom } = await section.evaluate((el) => ({
        top: el.getBoundingClientRect().top,
        headerBottom: document.querySelector('.site-header').getBoundingClientRect().bottom,
        atBottom: Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1,
      }));
      if (!atBottom) {
        expect(top, 'section top should sit just below the sticky header').toBeGreaterThanOrEqual(headerBottom - 2);
        expect(top).toBeLessThan(headerBottom + 60);
      }
    });
  }

  test('active nav link updates while scrolling through sections', async ({ page }) => {
    for (const id of SECTION_IDS) {
      // Put the section's top at ~30% of the viewport (the observer's active band is 34%–45%).
      await page.evaluate((sid) => {
        const el = document.getElementById(sid);
        const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3;
        window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
      }, id);

      const link = page.locator(`#nav-links a[href="#${id}"]`);
      await expect(link, `#${id} link should become active`).toHaveClass(/\bactive\b/);
      await expect(link).toHaveAttribute('aria-current', 'location');
      await expect(page.locator('#nav-links .nav-link.active')).toHaveCount(1);
    }
  });

  test('header changes appearance after scrolling', async ({ page }) => {
    const header = page.locator('.site-header');
    await expect(header).not.toHaveClass(/\bscrolled\b/);
    // On phones (≤640px) the background is already opaque, so only the border
    // colour changes there — compare both properties together.
    const look = () => header.evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.backgroundColor} | ${s.borderBottomColor}`;
    });
    const before = await look();

    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
    await expect(header).toHaveClass(/\bscrolled\b/);
    await expect.poll(look, { message: 'header should look different once scrolled' }).not.toBe(before);

    // Header stays pinned to the top while scrolling.
    const top = await header.evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBe(0);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(header).not.toHaveClass(/\bscrolled\b/);
  });

  test('scroll progress bar grows as the page is scrolled', async ({ page }) => {
    const width = () => page.locator('#scroll-progress').evaluate((el) => parseFloat(el.style.width) || 0);
    expect(await width()).toBe(0);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await expect.poll(width).toBeGreaterThan(99);
  });

  test('brand logo, hero buttons and "Back to top" link go to the right sections', async ({ page }) => {
    await page.locator('.hero-actions a[href="#projects"]').click();
    await waitForScrollEnd(page);
    await expect(page.locator('#projects')).toBeInViewport();

    await page.locator('.footer .back-to-top').click();
    await waitForScrollEnd(page);
    await expect(page.locator('#home')).toBeInViewport();

    await page.locator('.hero-actions a[href="#contact"]').click();
    await waitForScrollEnd(page);
    await expect(page.locator('#contact')).toBeInViewport();

    await page.locator('.site-header .brand').click();
    await waitForScrollEnd(page);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(5);
  });
});

test.describe('Mobile hamburger menu', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
    test.skip(!usesMobileMenu(page), 'Hamburger menu only exists at ≤900px');
  });

  test('menu toggle opens and closes the navigation', async ({ page }) => {
    const toggle = page.locator('#menu-toggle');
    const links = page.locator('#nav-links');
    await expect(toggle).toBeVisible();
    await expect(links).toBeHidden();

    await toggle.click();
    await expect(links).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAttribute('aria-label', 'Close menu');

    await toggle.click();
    await expect(links).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-label', 'Open menu');
  });

  test('menu closes after choosing a link', async ({ page }) => {
    await page.locator('#menu-toggle').click();
    await page.locator('#nav-links a[href="#skills"]').click();
    await expect(page.locator('#nav-links')).toBeHidden();
    await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  });

  test('menu closes with the Escape key', async ({ page }) => {
    await page.locator('#menu-toggle').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#nav-links')).toBeHidden();
  });

  test('menu closes when clicking outside it', async ({ page }) => {
    await page.locator('#menu-toggle').click();
    await expect(page.locator('#nav-links')).toBeVisible();
    await page.locator('.hero-lead').click();
    await expect(page.locator('#nav-links')).toBeHidden();
  });

  test('open menu fits inside the viewport', async ({ page }) => {
    await page.locator('#menu-toggle').click();
    const box = await page.locator('#nav-links').boundingBox();
    const vw = page.viewportSize().width;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vw);
  });
});
