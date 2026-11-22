import { test, expect } from '@playwright/test';

test.describe('Admin dashboard approvals', () => {
  test('Approve removes item from Pending Approvals', async ({ page, playwright }) => {
    const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:3001';
    const emp = await playwright.request.newContext({ baseURL: apiBase });
    const loginEmp = await emp.post('/api/auth/login', {
      data: { email: 'rahul.verma@automystics.com', password: 'demo123' },
    });
    expect(loginEmp.ok()).toBeTruthy();
    const start = `2027-04-${String(1 + Math.floor(Math.random() * 20)).padStart(2, '0')}`;
    const leaveRes = await emp.post('/api/leave', {
      data: {
        type: 'Personal',
        startDate: start,
        endDate: start,
        days: 1,
        reason: `E2E approval ${Date.now()}`,
        leaveTypeCode: 'personal',
      },
    });
    expect(leaveRes.ok()).toBeTruthy();
    const leaveBody = await leaveRes.json();
    expect(leaveBody.approvalRequestId).toBeTruthy();
    await emp.dispose();

    await page.goto('/');
    await page.locator('#email').fill('alvi@automystics.com');
    await page.locator('#password').fill('demo123');
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await expect(page.getByText('Pending Approvals', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^Approve$/i }).first()).toBeVisible({ timeout: 10_000 });

    const before = await page.getByRole('button', { name: /^Approve$/i }).count();
    await page.getByRole('button', { name: /^Approve$/i }).first().click();
    await expect(page.getByText('Approved').first()).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => page.getByRole('button', { name: /^Approve$/i }).count(), { timeout: 10_000 })
      .toBeLessThan(before);
  });

  test('Quick Actions navigate', async ({ page }) => {
    await page.goto('/');
    await page.locator('#email').fill('alvi@automystics.com');
    await page.locator('#password').fill('demo123');
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await page.getByRole('button', { name: /View Attendance/i }).click();
    await expect(page.getByRole('heading', { name: /Attendance & Leave/i })).toBeVisible({ timeout: 10_000 });
  });
});
