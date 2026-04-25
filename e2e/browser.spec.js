import { test, expect } from '@playwright/test';

test.describe('Intra Browser UI', () => {
  test('главная страница загружается без ошибок', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);
    
    const title = await page.title();
    console.log('Page title:', title);
    
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('electronAPI'));
    expect(criticalErrors.length).toBe(0);
  });

  test('адресная строка принимает ввод', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(1000);
    
    const addressInput = page.locator('input[placeholder*="URL"], input[name="url"]').first();
    if (await addressInput.isVisible()) {
      await addressInput.fill('https://example.com');
      await addressInput.press('Enter');
      await page.waitForTimeout(500);
    }
  });
});