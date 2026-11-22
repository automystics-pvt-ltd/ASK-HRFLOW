import { test, expect } from '@playwright/test';

test.describe('Admin dashboard approvals', () => {
  test('Approve removes item from Pending Approvals', async ({ page, playwright }) => {
    const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:3001';
    const emp = await playwright.request.newContext({ baseURL: apiBase });
    const loginEmp = await emp.post('/api/auth/login', {
      data: { email: 'rahul.verma@automystics.com', password: 'demo123' },
    });
    expect(loginEmp.ok()).toBeTruthy();
    // Unique weekday far ahead to avoid weekend/holiday policy and overlap flakes
    const d = new Date(Date.UTC(2028, 0, 3)); // 2028-01-03 Monday
    d.setUTCDate(d.getUTCDate() + Math.floor(Math.random() * 200));
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    const start = d.toISOString().slice(0, 10);
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
    // Mandatory reason dialog
    await expect(page.getByRole('heading', { name: /Approval reason/i })).toBeVisible({ timeout: 5_000 });
    await page.locator('#approval-reason').fill('E2E approved with mandatory comment');
    await page.getByRole('button', { name: /^Approve$/i }).last().click();
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
