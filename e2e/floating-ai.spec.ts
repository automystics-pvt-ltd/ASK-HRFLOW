import { test, expect } from '@playwright/test';

test.describe('Floating ASK AI', () => {
  test('FAB opens and closes the chat panel', async ({ page }) => {
    await page.goto('/');
    await page.locator('#email').fill('alvi@automystics.com');
    await page.locator('#password').fill('demo123');
    await page.getByRole('button', { name: /^Sign in$/i }).click();

    const fab = page.locator('#ask-ai-fab');
    await expect(fab).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#ask-ai-root')).toHaveAttribute('data-ask-ai-panel', 'closed');

    await fab.click();
    await expect(page.locator('#ask-ai-root')).toHaveAttribute('data-ask-ai-panel', 'open', {
      timeout: 10_000,
    });
    await expect(page.getByRole('dialog', { name: /ASK AI assistant/i })).toBeVisible();
    await expect(page.getByText(/Hi — I'm ASK AI/i).first()).toBeVisible();

    await fab.click();
    await expect(page.locator('#ask-ai-root')).toHaveAttribute('data-ask-ai-panel', 'closed');
  });
});
