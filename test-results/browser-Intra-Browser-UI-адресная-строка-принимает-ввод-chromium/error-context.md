# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser.spec.js >> Intra Browser UI >> адресная строка принимает ввод
- Location: e2e\browser.spec.js:20:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Intra Browser UI', () => {
  4  |   test('главная страница загружается без ошибок', async ({ page }) => {
  5  |     const errors = [];
  6  |     page.on('console', msg => {
  7  |       if (msg.type() === 'error') errors.push(msg.text());
  8  |     });
  9  |     
  10 |     await page.goto('http://localhost:3000');
  11 |     await page.waitForTimeout(2000);
  12 |     
  13 |     const title = await page.title();
  14 |     console.log('Page title:', title);
  15 |     
  16 |     const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('electronAPI'));
  17 |     expect(criticalErrors.length).toBe(0);
  18 |   });
  19 | 
  20 |   test('адресная строка принимает ввод', async ({ page }) => {
> 21 |     await page.goto('http://localhost:3000');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
  22 |     await page.waitForTimeout(1000);
  23 |     
  24 |     const addressInput = page.locator('input[placeholder*="URL"], input[name="url"]').first();
  25 |     if (await addressInput.isVisible()) {
  26 |       await addressInput.fill('https://example.com');
  27 |       await addressInput.press('Enter');
  28 |       await page.waitForTimeout(500);
  29 |     }
  30 |   });
  31 | });
```