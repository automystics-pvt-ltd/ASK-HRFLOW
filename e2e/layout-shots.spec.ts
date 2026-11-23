import { test, expect } from '@playwright/test';

test('admin desktop no overlap', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#email').fill('alvi@automystics.com');
  await page.locator('#password').fill('demo123');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page.getByRole('button', { name: /^Employees$/i }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Good (morning|afternoon|evening), Alvi/i)).toBeVisible();
  // Sidebar brand and hero greeting both visible = no overlap obscuring content
  const hero = page.getByText(/Good (morning|afternoon|evening), Alvi/i);
  const box = await hero.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.x).toBeGreaterThan(200); // to the right of ~16rem sidebar
  await page.screenshot({ path: '/opt/cursor/artifacts/admin-desktop-layout.png', fullPage: false });
});

test('employee desktop no overlap', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#email').fill('rahul.verma@automystics.com');
  await page.locator('#password').fill('demo123');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  // Employee shell: Attendance in sidebar (or Dashboard hero) after login
  await expect(
    page.getByRole('button', { name: /^(Attendance|Dashboard)$/i }).first(),
  ).toBeVisible({ timeout: 15000 });
  const hero = page.getByText(/Good (morning|afternoon|evening), Rahul/i);
  await expect(hero).toBeVisible({ timeout: 15000 });
  const box = await hero.boundingBox();
  expect(box!.x).toBeGreaterThan(200);
  await page.screenshot({ path: '/opt/cursor/artifacts/employee-desktop-layout.png', fullPage: false });
});

test('admin mobile shell', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#email').fill('alvi@automystics.com');
  await page.locator('#password').fill('demo123');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page.getByText(/Good (morning|afternoon|evening), Alvi/i)).toBeVisible({ timeout: 15000 });
  const hero = page.getByText(/Good (morning|afternoon|evening), Alvi/i);
  const box = await hero.boundingBox();
  expect(box!.x).toBeLessThan(40); // full width, no desktop sidebar
  await page.screenshot({ path: '/opt/cursor/artifacts/admin-mobile-layout.png', fullPage: false });
});
