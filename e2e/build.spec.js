import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const VITE_PORT = 4173;

test.describe('Intra Browser Build', () => {
  test('preview server запускается', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.goto(`http://localhost:${VITE_PORT}`);
    await page.waitForTimeout(2000);
    
    const html = await page.content();
    expect(html).toContain('root');
    
    const criticalErrors = errors.filter(e => !e.includes('favicon'));
    expect(criticalErrors.length).toBe(0);
  });
});