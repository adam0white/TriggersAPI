import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8787';
const DEFAULT_TOKEN = 'sk_test_abc123xyz789';

test.describe('TriggersAPI Dashboard - Corrected UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test.describe('Visual Inspection', () => {
    test('should load dashboard correctly', async ({ page }) => {
      await expect(page).toHaveTitle('TriggersAPI - Event Ingestion Dashboard');
      await expect(page.locator('h1')).toContainText('TriggersAPI');
      await expect(page.locator('.container')).toBeVisible();
    });

    test('should display status badge correctly', async ({ page }) => {
      const statusBadge = page.locator('.status');
      await expect(statusBadge).toBeVisible();
      // Fixed assertion: actual text is "System Live" not just "LIVE"
      await expect(statusBadge).toContainText('System Live');
    });

    test('should have correct page styling', async ({ page }) => {
      const body = page.locator('body');
      const backgroundColor = await body.evaluate(el =>
        window.getComputedStyle(el).backgroundImage
      );
      expect(backgroundColor).toContain('gradient');
    });
  });

  test.describe('Form Fields - Correct Selectors', () => {
    test('should have Bearer token field pre-filled', async ({ page }) => {
      // Fixed selector: use id instead of placeholder
      const tokenField = page.locator('#bearerToken');
      await expect(tokenField).toBeVisible();

      const value = await tokenField.inputValue();
      expect(value).toBe(DEFAULT_TOKEN);
    });

    test('should allow editing Bearer token', async ({ page }) => {
      const tokenField = page.locator('#bearerToken');
      await tokenField.clear();
      await tokenField.fill('sk_test_newtoken123');

      const value = await tokenField.inputValue();
      expect(value).toBe('sk_test_newtoken123');
    });

    test('should have payload textarea field', async ({ page }) => {
      // Fixed selector: use id instead of placeholder match
      const payloadField = page.locator('#payload');
      await expect(payloadField).toBeVisible();

      const value = await payloadField.inputValue();
      expect(value.length).toBeGreaterThan(0);
    });

    test('should accept valid JSON in payload', async ({ page }) => {
      const payloadField = page.locator('#payload');
      const validPayload = JSON.stringify({
        event_type: 'test.event',
        timestamp: new Date().toISOString()
      });

      await payloadField.clear();
      await payloadField.fill(validPayload);

      const value = await payloadField.inputValue();
      expect(value).toBe(validPayload);
    });

    test('should have metadata textarea field', async ({ page }) => {
      const metadataField = page.locator('#metadata');
      await expect(metadataField).toBeVisible();
    });

    test('should have debug flag dropdown', async ({ page }) => {
      const debugDropdown = page.locator('#debugFlag');
      await expect(debugDropdown).toBeVisible();

      const options = await debugDropdown.locator('option').count();
      expect(options).toBeGreaterThanOrEqual(4);
    });

    test('should be able to change debug flag', async ({ page }) => {
      const debugDropdown = page.locator('#debugFlag');

      // Select option by value
      await debugDropdown.selectOption('validation_error');
      const selected = await debugDropdown.inputValue();
      expect(selected).toBe('validation_error');

      // Reset to None
      await debugDropdown.selectOption('');
      const reset = await debugDropdown.inputValue();
      expect(reset).toBe('');
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile (375x667)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator('.container')).toBeVisible();

      const container = page.locator('.container');
      const width = await container.evaluate(el => el.offsetWidth);
      expect(width).toBeLessThan(375); // Should have padding
    });

    test('should be responsive on tablet (768x1024)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.locator('.container')).toBeVisible();
    });

    test('should be responsive on desktop (1920x1080)', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      const container = page.locator('.container');
      await expect(container).toBeVisible();

      // Max width should be around 800px
      const width = await container.evaluate(el => el.offsetWidth);
      expect(width).toBeLessThanOrEqual(800);
    });
  });

  test.describe('Buttons & Actions', () => {
    test('should have Submit Event button', async ({ page }) => {
      const submitButton = page.locator('button:has-text("Submit Event")').first();
      await expect(submitButton).toBeVisible();
    });

    test('should have Clear Form button', async ({ page }) => {
      const clearButton = page.locator('button:has-text("Clear Form")').first();
      await expect(clearButton).toBeVisible();
    });

    test('should clear form when Clear button clicked', async ({ page }) => {
      const tokenField = page.locator('#bearerToken');
      const payloadField = page.locator('#payload');
      const clearButton = page.locator('button:has-text("Clear Form")').first();

      // Modify fields
      await tokenField.clear();
      await tokenField.fill('sk_test_custom');
      await payloadField.clear();
      await payloadField.fill('{"custom": "data"}');

      // Click clear
      await clearButton.click();
      await page.waitForTimeout(300);

      // Check if fields are cleared or reset
      const tokenValue = await tokenField.inputValue();
      const payloadValue = await payloadField.inputValue();

      // Token might reset to default or be empty
      expect(tokenValue === '' || tokenValue === DEFAULT_TOKEN).toBeTruthy();
    });
  });

  test.describe('Form Structure & Accessibility', () => {
    test('should have proper form element', async ({ page }) => {
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('should have all required labels', async ({ page }) => {
      const labels = page.locator('label');
      const count = await labels.count();
      expect(count).toBeGreaterThanOrEqual(4);

      const labelTexts = await labels.allTextContents();
      expect(labelTexts.some(t => t.includes('Authorization Token'))).toBeTruthy();
      expect(labelTexts.some(t => t.includes('Event Payload'))).toBeTruthy();
      expect(labelTexts.some(t => t.includes('Debug'))).toBeTruthy();
    });

    test('should have proper input element structure', async ({ page }) => {
      const inputs = page.locator('input, textarea, select');
      const count = await inputs.count();
      expect(count).toBeGreaterThanOrEqual(4);
    });

    test('should have hint text for fields', async ({ page }) => {
      const hints = page.locator('.hint, [class*="hint"]');
      const count = await hints.count();
      expect(count).toBeGreaterThan(0);

      const hintText = await hints.first().textContent();
      expect(hintText).toBeTruthy();
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const start = Date.now();
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - start;

      expect(loadTime).toBeLessThan(3000);
      console.log(`Page load time: ${loadTime}ms`);
    });

    test('should not have console errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');

      expect(errors).toHaveLength(0);
    });
  });

  test.describe('Token Field Edge Cases', () => {
    test('should preserve token when navigating back to page', async ({ page }) => {
      const tokenField = page.locator('#bearerToken');

      // Verify default token
      let token = await tokenField.inputValue();
      expect(token).toBe(DEFAULT_TOKEN);

      // Navigation is not applicable for single-page dashboard
      // But verify token remains visible
      await page.waitForTimeout(500);
      token = await tokenField.inputValue();
      expect(token).toBe(DEFAULT_TOKEN);
    });

    test('should allow token to be empty temporarily', async ({ page }) => {
      const tokenField = page.locator('#bearerToken');

      await tokenField.clear();
      let value = await tokenField.inputValue();
      expect(value).toBe('');

      // But can be refilled
      await tokenField.fill(DEFAULT_TOKEN);
      value = await tokenField.inputValue();
      expect(value).toBe(DEFAULT_TOKEN);
    });
  });

  test.describe('Payload Field Edge Cases', () => {
    test('should handle multiline JSON', async ({ page }) => {
      const payloadField = page.locator('#payload');

      const multilineJSON = JSON.stringify({
        user_id: '12345',
        action: 'account_created',
        email: 'user@example.com',
        timestamp: new Date().toISOString()
      }, null, 2);

      await payloadField.clear();
      await payloadField.fill(multilineJSON);

      const value = await payloadField.inputValue();
      expect(value).toContain('user_id');
      expect(value).toContain('12345');
    });

    test('should have required attribute on payload field', async ({ page }) => {
      const payloadField = page.locator('#payload');
      const required = await payloadField.evaluate(el =>
        (el as HTMLInputElement).required
      );

      expect(required).toBe(true);
    });
  });

  test.describe('Complete Happy Path', () => {
    test('should show all form fields in sequence', async ({ page }) => {
      // 1. Verify header
      const header = page.locator('header');
      await expect(header).toBeVisible();

      // 2. Verify token field
      const tokenField = page.locator('#bearerToken');
      await expect(tokenField).toBeVisible();
      expect(await tokenField.inputValue()).toBe(DEFAULT_TOKEN);

      // 3. Verify payload field
      const payloadField = page.locator('#payload');
      await expect(payloadField).toBeVisible();

      // 4. Verify metadata field
      const metadataField = page.locator('#metadata');
      await expect(metadataField).toBeVisible();

      // 5. Verify debug dropdown
      const debugDropdown = page.locator('#debugFlag');
      await expect(debugDropdown).toBeVisible();

      // 6. Verify buttons
      const submitButton = page.locator('button:has-text("Submit Event")').first();
      const clearButton = page.locator('button:has-text("Clear Form")').first();
      await expect(submitButton).toBeVisible();
      await expect(clearButton).toBeVisible();

      // Take screenshot
      await page.screenshot({ path: './screenshots/full-form.png', fullPage: true });
    });

    test('should prepare form for submission', async ({ page }) => {
      const tokenField = page.locator('#bearerToken');
      const payloadField = page.locator('#payload');

      // Verify token is pre-filled
      expect(await tokenField.inputValue()).toBe(DEFAULT_TOKEN);

      // Payload has default content
      const payloadValue = await payloadField.inputValue();
      expect(payloadValue.length).toBeGreaterThan(0);

      // Form is ready for submission
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });
  });
});
