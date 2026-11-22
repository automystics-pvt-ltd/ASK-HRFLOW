import { test, expect } from '@playwright/test';

test.describe('Branding, holidays, docs settings', () => {
  test('admin settings shows branding and holidays from API', async ({ page }) => {
    await page.goto('/');
    await page.locator('#email').fill('alvi@automystics.com');
    await page.locator('#password').fill('demo123');
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await page.getByRole('button', { name: /^Settings$/i }).first().click();
    await expect(page.getByText(/Branding & theme/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input').filter({ hasText: '' }).first()).toBeVisible();
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/Republic Day|Independence Day|Christmas|New Year|Company Foundation|Diwali/i).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Document templates|Generate document/i).first()).toBeVisible();
  });

  test('employee dashboard shows API holidays and location capture', async ({ page }) => {
    await page.goto('/');
    await page.locator('#email').fill('rahul.verma@automystics.com');
    await page.locator('#password').fill('demo123');
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page.getByText(/day at a glance/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Your location is captured automatically/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Upcoming holidays/i })).toBeVisible();
    await expect(page.getByText(/Christmas Day|New Year|Republic Day|No upcoming holidays/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
