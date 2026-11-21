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
    await expect(details.locator('h4')).toHaveText('What this project covers');
    await expect(details.locator('li')).toHaveText([
      'Multi-branch appointment booking',
      'Staff and service management',
      'Inventory tracking and reports',
      'Web interface development and team collaboration',
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
    for (const sel of ['.btn-project', '#project-details-btn']) {
      const b = await page.locator(sel).boundingBox();
      expect(b.height, `${sel} tap target height`).toBeGreaterThanOrEqual(24);
      expect(b.x + b.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
    }
  });
});
