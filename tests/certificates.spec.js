const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect, gotoHome, openMenuIfNeeded, waitForScrollEnd, stubExternalSites } = require('./fixtures');

// Uses tests/data/certificates.fixture.js (served automatically by fixtures.js).
const ALPHA = 'Test Certificate Alpha';
const BETA = 'Test Certificate Beta With A Deliberately Long Title To Check Wrapping';
const GAMMA = 'Test Certificate Gamma';

const card = (page, title) => page.locator('.cert-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

test.describe('Certificates section', () => {
  test.beforeEach(async ({ page, context }) => {
    await stubExternalSites(context);
    await gotoHome(page);
  });

  test('section and nav link appear when certificates exist', async ({ page }) => {
    await expect(page.locator('#certificates')).toBeAttached();
    await expect(page.locator('#certificates')).not.toHaveAttribute('hidden');
    await expect(page.locator('#nav-links a[href="#certificates"]')).not.toHaveAttribute('hidden');
    await expect(page.locator('#certificates h2')).toContainText('Certified learning');
    await expect(page.locator('#contact .section-tag')).toContainText('06 / GET IN TOUCH');
  });

  test('renders one card per certificate with issuer, title, date and detail', async ({ page }) => {
    await expect(page.locator('#cert-grid .cert-card')).toHaveCount(3);
    await expect(page.locator('#cert-grid .cert-card h3')).toHaveText([ALPHA, BETA, GAMMA]);
    await expect(page.locator('#cert-grid .cert-index')).toHaveText(['01', '02', '03']);

    const a = card(page, ALPHA);
    await expect(a.locator('.cert-issuer')).toHaveText('Test Academy');
    await expect(a.locator('.cert-meta span')).toHaveText(['Issued June 2024', 'Certificate of Completion']);

    // Optional fields: Gamma has no detail and no image.
    const g = card(page, GAMMA);
    await expect(g.locator('.cert-meta span')).toHaveText(['Issued March 2023']);
    await expect(g.locator('.cert-view')).toHaveCount(0);
  });

  test('"Certificates" nav link scrolls to the section', async ({ page }) => {
    await openMenuIfNeeded(page);
    await page.locator('#nav-links a[href="#certificates"]').click();
    await waitForScrollEnd(page);
    await expect(page).toHaveURL(/#certificates$/);
    await expect(page.locator('#certificates')).toBeInViewport();
  });

  test('cards reveal when scrolled into view', async ({ page }) => {
    const first = page.locator('.cert-card').first();
    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveClass(/\bvisible\b/);
  });

  test('"View certificate" opens a preview with the right certificate', async ({ page }) => {
    const btn = card(page, ALPHA).getByRole('button', { name: `View certificate: ${ALPHA}` });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();

    const dialog = page.getByRole('dialog', { name: ALPHA });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#cert-dialog-issuer')).toHaveText('Test Academy');
    await expect(dialog.locator('#cert-dialog-meta')).toHaveText('Issued June 2024 · Certificate of Completion');
    const img = dialog.getByRole('img', { name: `Certificate: ${ALPHA}, issued by Test Academy` });
    await expect(img).toHaveAttribute('src', 'certificates/test-alpha.webp');
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0), { message: 'image loads' }).toBe(true);

    // Switching certificates updates the content.
    await page.keyboard.press('Escape');
    await card(page, BETA).locator('.cert-view').click();
    await expect(page.getByRole('dialog', { name: BETA })).toBeVisible();
    await expect(page.locator('#cert-dialog-img')).toHaveAttribute('src', 'certificates/test-beta.webp');
  });

  test('preview closes with Escape, the close button, and a backdrop click', async ({ page }) => {
    const btn = card(page, ALPHA).locator('.cert-view');
    const dialog = page.locator('#cert-dialog');

    await btn.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await btn.click();
    await page.getByRole('button', { name: 'Close certificate preview' }).click();
    await expect(dialog).toBeHidden();

    await btn.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(3, page.viewportSize().height - 3); // corner = backdrop
    await expect(dialog).toBeHidden();
  });

  test('clicking inside the preview does not close it', async ({ page }) => {
    await card(page, ALPHA).locator('.cert-view').click();
    await page.locator('#cert-dialog-img').click();
    await page.locator('#cert-dialog-title').click();
    await expect(page.locator('#cert-dialog')).toBeVisible();
  });

  test('keyboard: opens with Enter, focus moves into the preview and returns afterwards', async ({ page }) => {
    const btn = card(page, ALPHA).locator('.cert-view');
    await btn.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#cert-dialog')).toBeVisible();
    expect(await page.evaluate(() => !!document.activeElement.closest('#cert-dialog'))).toBe(true);

    // Focus is trapped: tabbing never leaves the open dialog.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement.closest('#cert-dialog') || document.activeElement === document.body)).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(btn).toBeFocused();
  });

  test('page behind the preview cannot scroll', async ({ page }) => {
    await card(page, ALPHA).locator('.cert-view').click();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  });

  test('preview fits on screen without horizontal scrolling', async ({ page }) => {
    await card(page, BETA).locator('.cert-view').click();
    const vp = page.viewportSize();
    const box = await page.locator('#cert-dialog').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    expect(box.height).toBeLessThanOrEqual(vp.height);
    const img = await page.locator('#cert-dialog-img').boundingBox();
    expect(img.x + img.width).toBeLessThanOrEqual(box.x + box.width);
    await expect(page.getByRole('button', { name: 'Close certificate preview' })).toBeInViewport();
  });

  test('"Verify" links open the verification page in a new tab', async ({ page, context }) => {
    const verify = card(page, GAMMA).getByRole('link', { name: /Verify/ });
    await expect(verify).toHaveAttribute('href', 'https://example.com/verify/gamma');
    await expect(verify).toHaveAttribute('target', '_blank');
    await expect(verify).toHaveAttribute('rel', /noreferrer/);
    await verify.scrollIntoViewIfNeeded();
    const [popup] = await Promise.all([context.waitForEvent('page'), verify.click()]);
    expect(popup.url()).toBe('https://example.com/verify/gamma');
  });

  test('certificates section and open preview have no axe violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    const section = await new AxeBuilder({ page }).include('#certificates').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(section.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    await card(page, ALPHA).locator('.cert-view').click();
    const dialog = await new AxeBuilder({ page }).include('#cert-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(dialog.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('certificate text is inserted as text, never as HTML', async ({ page }) => {
    await page.route('**/certificates.js', (route) => route.fulfill({
      contentType: 'text/javascript',
      body: 'window.CERTIFICATES=[{title:"<img src=x onerror=window.__xss=1>",issuer:"<b>x</b>",issued:"2024"}];',
    }));
    await page.reload();
    await expect(page.locator('.cert-card h3')).toHaveText('<img src=x onerror=window.__xss=1>');
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(page.locator('.cert-card img, .cert-card b')).toHaveCount(0);
  });
});

test.describe('Certificates section – empty list', () => {
  test('section and nav link stay hidden while certificates.js is empty', async ({ page }) => {
    await page.route('**/certificates.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.CERTIFICATES = [];' }));
    await gotoHome(page);
    await expect(page.locator('#certificates')).toBeHidden();
    await expect(page.locator('#nav-links a[href="#certificates"]')).toBeHidden();
    await expect(page.locator('.cert-card')).toHaveCount(0);
  });

  test('the real certificates.js loads without errors', async ({ page }) => {
    await page.route('**/certificates.js', (route) => route.continue()); // bypass the test data
    await gotoHome(page);
    expect(await page.evaluate(() => Array.isArray(window.CERTIFICATES))).toBe(true);
  });
});
