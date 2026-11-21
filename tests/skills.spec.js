const { test, expect, gotoHome } = require('./fixtures');

// Expected cards per filter, taken from the data-category values in index.html.
const EXPECTED = {
  all: ['Router & Switch Setup', 'Hardware Setup', 'Cable Management', 'IT Troubleshooting', 'Wi-Fi & IP Addressing', 'Communication & Teamwork'],
  network: ['Router & Switch Setup', 'Wi-Fi & IP Addressing'],
  hardware: ['Hardware Setup', 'Cable Management', 'IT Troubleshooting'],
  soft: ['Communication & Teamwork'],
};
const LABELS = { all: 'All Skills', network: 'Networking', hardware: 'Hardware & Support', soft: 'Soft Skills' };

async function visibleSkillTitles(page) {
  return page.locator('#skills-grid .skill-card:visible h3').allTextContents();
}

async function expectOnlyActive(page, filter) {
  for (const [key, label] of Object.entries(LABELS)) {
    const tab = page.getByRole('button', { name: label, exact: true });
    const on = key === filter;
    await expect(tab).toHaveAttribute('aria-pressed', String(on));
    if (on) await expect(tab).toHaveClass(/\bactive\b/);
    else await expect(tab).not.toHaveClass(/\bactive\b/);
  }
}

test.describe('Skills section', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
    await page.locator('#skills').scrollIntoViewIfNeeded();
  });

  test('shows all skills with "All Skills" selected by default', async ({ page }) => {
    await expectOnlyActive(page, 'all');
    expect(await visibleSkillTitles(page)).toEqual(EXPECTED.all);
  });

  for (const filter of ['network', 'hardware', 'soft', 'all']) {
    test(`"${LABELS[filter]}" button shows exactly the ${filter} skills`, async ({ page }) => {
      await page.getByRole('button', { name: LABELS[filter], exact: true }).click();
      await expectOnlyActive(page, filter);
      expect(await visibleSkillTitles(page)).toEqual(EXPECTED[filter]);
      // Hidden cards must be truly hidden (not just invisible) so they don't take up space.
      const hidden = page.locator('#skills-grid .skill-card[hidden]');
      await expect(hidden).toHaveCount(EXPECTED.all.length - EXPECTED[filter].length);
      for (const card of await hidden.all()) await expect(card).toBeHidden();
    });
  }

  test('switching between every pair of categories always shows the right skills', async ({ page }) => {
    const sequence = ['network', 'soft', 'hardware', 'network', 'all', 'soft', 'all', 'hardware'];
    for (const filter of sequence) {
      await page.getByRole('button', { name: LABELS[filter], exact: true }).click();
      await expectOnlyActive(page, filter);
      expect(await visibleSkillTitles(page), `after selecting ${filter}`).toEqual(EXPECTED[filter]);
    }
  });

  test('clicking the already-selected filter keeps the same result', async ({ page }) => {
    const btn = page.getByRole('button', { name: LABELS.network, exact: true });
    await btn.click();
    await btn.click();
    expect(await visibleSkillTitles(page)).toEqual(EXPECTED.network);
  });

  test('filters can be used with the keyboard (Enter and Space)', async ({ page }) => {
    await page.getByRole('button', { name: LABELS.hardware, exact: true }).focus();
    await page.keyboard.press('Enter');
    expect(await visibleSkillTitles(page)).toEqual(EXPECTED.hardware);

    await page.getByRole('button', { name: LABELS.soft, exact: true }).focus();
    await page.keyboard.press('Space');
    expect(await visibleSkillTitles(page)).toEqual(EXPECTED.soft);
  });

  test('filter buttons are grouped and labelled for assistive technology', async ({ page }) => {
    await expect(page.getByRole('group', { name: 'Filter skills' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Filter skills' }).getByRole('button')).toHaveCount(4);
  });
});
