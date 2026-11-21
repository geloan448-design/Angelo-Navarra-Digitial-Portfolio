const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect, gotoHome, stubExternalSites } = require('./fixtures');

test.describe('Projects section', () => {
  test.beforeEach(async ({ page, context }) => {
    await stubExternalSites(context);
    await gotoHome(page);
    await page.locator('#projects').scrollIntoViewIfNeeded();
  });

  test('project details are collapsed on load', async ({ page }) => {
    const btn = page.locator('#project-details-btn');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(btn).toHaveAttribute('aria-controls', 'project-details');
    await expect(page.locator('#project-details')).toBeHidden();
    await expect(btn.locator('.detail-chevron')).toHaveText('↓');
  });

  test('"Project details" expands the details panel', async ({ page }) => {
    const btn = page.locator('#project-details-btn');
    await btn.click();
    const details = page.locator('#project-details');
    await expect(details).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(btn.locator('.detail-chevron')).toHaveText('↑');
    await expect(details.locator('h4')).toHaveText('Key features');
    await expect(details.locator('li')).toHaveText([
      'Online appointment booking across three branches in Albay',
      'Service and stylist selection with appointment scheduling',
      'Online payments with multiple options (PayMongo)',
      'Email and SMS verification',
      'Booking tracking for customers',
      'Account registration and login',
      'Home and event service requests',
      'Team Portal for staff and service management',
      'Inventory tracking and reports',
    ]);
  });

  test('"Project details" collapses the panel when clicked again', async ({ page }) => {
    const btn = page.locator('#project-details-btn');
    await btn.click();
    await expect(page.locator('#project-details')).toBeVisible();
    await btn.click();
    await expect(page.locator('#project-details')).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(btn.locator('.detail-chevron')).toHaveText('↓');
  });

  test('details toggle works repeatedly and from the keyboard', async ({ page }) => {
    const btn = page.locator('#project-details-btn');
    const details = page.locator('#project-details');
    for (let i = 0; i < 3; i++) {
      await btn.focus();
      await page.keyboard.press('Enter');
      await expect(details).toBeVisible();
      await page.keyboard.press('Space');
      await expect(details).toBeHidden();
    }
  });

  test('"View Repository" link opens the GitHub repository in a new tab', async ({ page, context }) => {
    const link = page.getByRole('link', { name: /View Repository/ });
    await expect(link).toHaveAttribute('href', 'https://github.com/PauloBalaguer/Capstone-Salon-New');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noreferrer|noopener/);

    const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe('https://github.com/PauloBalaguer/Capstone-Salon-New');
    expect(page.url(), 'original tab stays on the portfolio').toContain('127.0.0.1');
  });

  test('card shows dates, team and tech stack', async ({ page }) => {
    const info = page.locator('.project-info');
    await expect(info.locator('.project-meta')).toHaveText('March – December 2026 · With Michael Kharl Agao & Paulo Balaguer');
    await expect(info.locator('.tech-tags span')).toHaveText(['PHP 8', 'MySQL / MariaDB', 'Tailwind CSS', 'JavaScript', 'PayMongo', 'Brevo', 'textbee SMS', 'Docker', 'Vercel']);
  });

  test('"Live Site" link opens the deployed salon platform in a new tab', async ({ page, context }) => {
    const link = page.getByRole('link', { name: /Live Site/ });
    await expect(link).toHaveAttribute('href', 'https://leo-mejillano-salon.site/');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noreferrer|noopener/);
    const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe('https://leo-mejillano-salon.site/');
  });

  test('screenshot gallery shows 8 labelled thumbnails that load', async ({ page }) => {
    const thumbs = page.locator('.gallery-thumb');
    await expect(thumbs).toHaveCount(8);
    await expect(thumbs.locator('span')).toHaveText(['Homepage', 'Branch directory', 'Services & pricing', 'Booking flow', 'Guest booking', 'Product catalog', 'Portal login', 'Mobile view']);
    for (const [i, t] of (await thumbs.all()).entries()) {
      await expect(t).toHaveAccessibleName(new RegExp(`^View screenshot ${i + 1} of 8: `));
      await t.scrollIntoViewIfNeeded();
      await expect.poll(() => t.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0), { message: `thumbnail ${i + 1} loads` }).toBe(true);
    }
  });

  test('clicking a thumbnail opens the full screenshot', async ({ page, request }) => {
    const thumb = page.getByRole('button', { name: 'View screenshot 3 of 8: Services & pricing' });
    await thumb.scrollIntoViewIfNeeded();
    await thumb.click();
    const dialog = page.getByRole('dialog', { name: 'Services & pricing' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#gallery-count')).toHaveText('Screenshot 3 of 8');
    await expect(dialog.locator('#gallery-caption')).toContainText('Per-branch price lists');
    const img = dialog.locator('#gallery-img');
    await expect(img).toHaveAttribute('src', 'projects/salon/03-services.webp');
    await expect(img).toHaveAttribute('alt', /Services & pricing/);
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
    // Every full-size file referenced by the gallery exists.
    for (const full of await page.locator('.gallery-thumb').evaluateAll((els) => els.map((e) => e.dataset.full))) {
      expect((await request.get(full)).status(), full).toBe(200);
    }
  });

  test('next/previous buttons and arrow keys move through screenshots and wrap around', async ({ page }) => {
    await page.locator('.gallery-thumb').first().click();
    const count = page.locator('#gallery-count');
    await expect(count).toHaveText('Screenshot 1 of 8');
    await page.getByRole('button', { name: 'Next screenshot' }).click();
    await expect(count).toHaveText('Screenshot 2 of 8');
    await expect(page.locator('#gallery-title')).toHaveText('Branch directory');
    await page.keyboard.press('ArrowRight');
    await expect(count).toHaveText('Screenshot 3 of 8');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(count).toHaveText('Screenshot 1 of 8');
    await page.getByRole('button', { name: 'Previous screenshot' }).click();
    await expect(count).toHaveText('Screenshot 8 of 8'); // wraps to the last one
    await expect(page.locator('#gallery-img')).toHaveAttribute('src', 'projects/salon/08-mobile.webp');
  });

  test('screenshot viewer closes with Escape, close button and backdrop; focus returns to the thumbnail', async ({ page }) => {
    const dialog = page.locator('#gallery-dialog');
    const first = page.locator('.gallery-thumb').first();
    await first.click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(first).toBeFocused();

    await first.click();
    await page.getByRole('button', { name: 'Close screenshot viewer' }).click();
    await expect(dialog).toBeHidden();

    await first.click();
    await page.keyboard.press('ArrowRight'); // move to #2, then close: focus goes to thumbnail #2
    await page.mouse.click(3, page.viewportSize().height - 3);
    await expect(dialog).toBeHidden();
    await expect(page.locator('.gallery-thumb').nth(1)).toBeFocused();
  });

  test('screenshot viewer fits the screen and passes axe', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('.gallery-thumb').nth(7).click(); // tall mobile screenshot
    const vp = page.viewportSize();
    const box = await page.locator('#gallery-dialog').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    expect(box.height).toBeLessThanOrEqual(vp.height);
    for (const name of ['Previous screenshot', 'Next screenshot', 'Close screenshot viewer']) {
      await expect(page.getByRole('button', { name })).toBeInViewport();
    }
    const results = await new AxeBuilder({ page }).include('#gallery-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('project card displays properly (stacked on phones, side-by-side on larger screens)', async ({ page }) => {
    const card = page.locator('.featured-project');
    // Wait for the reveal transition to finish so all boxes are measured at rest.
    await expect(card).toHaveClass(/\bvisible\b/);
    await card.evaluate((el) => Promise.all(el.getAnimations({ subtree: true })
      .filter((a) => a instanceof CSSTransition).map((a) => a.finished)));
    const art = await page.locator('.project-art').boundingBox();
    const info = await page.locator('.project-info').boundingBox();
    const cardBox = await card.boundingBox();
    const vw = page.viewportSize().width;

    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(vw);
    if (vw <= 640) {
      expect(info.y, 'info should be below the artwork on phones').toBeGreaterThanOrEqual(art.y + art.height - 1);
      expect(Math.abs(info.width - cardBox.width)).toBeLessThan(3);
    } else {
      expect(Math.abs(info.y - art.y)).toBeLessThan(3);
    }
    // Buttons remain fully visible and tappable (at least 24px tall – WCAG 2.2 target size).
    for (const sel of ['.btn-project', '.project-link', '#project-details-btn']) {
      const b = await page.locator(sel).boundingBox();
      expect(b.height, `${sel} tap target height`).toBeGreaterThanOrEqual(24);
      expect(b.x + b.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
    }
  });
});
