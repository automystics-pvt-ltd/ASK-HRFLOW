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

test('admin tablet audit logs readable', async ({ page }) => {
  // 820px is md+ (sidebar visible) but still < lg so Audit Logs uses the card list
  await page.setViewportSize({ width: 820, height: 1024 });
  await page.goto('/');
  await page.locator('#email').fill('alvi@automystics.com');
  await page.locator('#password').fill('demo123');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page.getByText(/Good (morning|afternoon|evening), Alvi/i)).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /^Audit Logs$/i }).first().click();
  await expect(page.getByRole('main').getByRole('heading', { name: /Audit Logs/i })).toBeVisible({
    timeout: 10000,
  });
  // Page itself should not require horizontal scroll; card list used below lg
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  await page.screenshot({ path: '/opt/cursor/artifacts/admin-tablet-audit-logs.png', fullPage: false });
});

test('admin mobile audit logs cards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#email').fill('alvi@automystics.com');
  await page.locator('#password').fill('demo123');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await expect(page.getByText(/Good (morning|afternoon|evening), Alvi/i)).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: /^Audit Logs$/i }).click();
  await expect(page.getByRole('main').getByRole('heading', { name: /Audit Logs/i })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText(/Search & filters/i)).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  await page.screenshot({ path: '/opt/cursor/artifacts/admin-mobile-audit-logs.png', fullPage: false });
});
