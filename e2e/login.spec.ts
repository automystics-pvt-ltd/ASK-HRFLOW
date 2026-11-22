import { test, expect } from '@playwright/test';

test.describe('ASK HRFlow login + role gate', () => {
  test('admin can sign in and see dashboard', async ({ page }) => {
    await page.goto('/');
    await page.locator('#email').fill('alvi@automystics.com');
    await page.locator('#password').fill('demo123');
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page.getByRole('button', { name: /^Employees$/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('employee signs in without Employees module', async ({ page }) => {
    await page.goto('/');
    await page.locator('#email').fill('rahul.verma@automystics.com');
    await page.locator('#password').fill('demo123');
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page.getByRole('button', { name: /^Attendance$/i }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^Employees$/i })).toHaveCount(0);
  });
});

