import { test, expect } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:8080';

test.describe('Auth pages live', () => {
  test('signup page loads without ErrorBoundary', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const response = await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText('حدث خطأ غير متوقع')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'إنشاء حساب جديد' })).toBeVisible({ timeout: 15000 });

    if (errors.length) {
      console.log('Page errors:', errors.join('\n'));
    }
    expect(errors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });

  test('login page loads without ErrorBoundary', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
    await expect(page.getByText('حدث خطأ غير متوقع')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible({ timeout: 15000 });
    expect(errors.filter((e) => !e.includes('favicon'))).toEqual([]);
  });
});
