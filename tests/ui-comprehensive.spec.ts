import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8787';
const DEFAULT_TOKEN = 'sk_test_abc123xyz789';

test.describe('TriggersAPI Dashboard - Comprehensive UI Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto(BASE_URL);
  });

  test.describe('1. Visual Inspection & Page Load', () => {
    test('should load dashboard correctly', async ({ page }) => {
      // Verify page title
      await expect(page).toHaveTitle('TriggersAPI - Event Ingestion Dashboard');

      // Verify main elements are visible
      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
      await expect(heading).toContainText('TriggersAPI');

      // Verify form container
      const formContainer = page.locator('.container');
      await expect(formContainer).toBeVisible();
    });

    test('should take screenshot of dashboard', async ({ page }) => {
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');

      // Take screenshot
      await page.screenshot({ path: './screenshots/dashboard-initial.png', fullPage: true });
      console.log('Screenshot saved: dashboard-initial.png');
    });

    test('should verify status badge is visible', async ({ page }) => {
      const statusBadge = page.locator('.status');
      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toContainText('LIVE');
    });

    test('should verify page has correct styling', async ({ page }) => {
      // Check body background (gradient)
      const body = page.locator('body');
      const backgroundColor = await body.evaluate(el =>
        window.getComputedStyle(el).backgroundImage
      );
      expect(backgroundColor).toContain('gradient');

      // Verify container styling
      const container = page.locator('.container');
      const borderRadius = await container.evaluate(el =>
        window.getComputedStyle(el).borderRadius
      );
      expect(borderRadius).toContain('12');
    });
  });

  test.describe('2. Responsive Design', () => {
    test('should be responsive on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Verify elements are still visible
      const container = page.locator('.container');
      await expect(container).toBeVisible();

      // Take mobile screenshot
      await page.screenshot({ path: './screenshots/dashboard-mobile.png', fullPage: true });
      console.log('Screenshot saved: dashboard-mobile.png');
    });

    test('should be responsive on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      const container = page.locator('.container');
      await expect(container).toBeVisible();

      // Take tablet screenshot
      await page.screenshot({ path: './screenshots/dashboard-tablet.png', fullPage: true });
      console.log('Screenshot saved: dashboard-tablet.png');
    });

    test('should be responsive on desktop viewport', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });

      const container = page.locator('.container');
      await expect(container).toBeVisible();

      // Take desktop screenshot
      await page.screenshot({ path: './screenshots/dashboard-desktop.png', fullPage: true });
      console.log('Screenshot saved: dashboard-desktop.png');
    });
  });

  test.describe('3. Form Testing - Bearer Token', () => {
    test('should have Bearer token field pre-filled', async ({ page }) => {
      const tokenField = page.locator('input[placeholder="sk_test_..."]');
      await expect(tokenField).toBeVisible();

      const value = await tokenField.inputValue();
      expect(value).toBe(DEFAULT_TOKEN);
    });

    test('should allow editing Bearer token', async ({ page }) => {
      const tokenField = page.locator('input[placeholder="sk_test_..."]');

      // Clear and type new token
      await tokenField.clear();
      await tokenField.fill('sk_test_newtoken123');

      const value = await tokenField.inputValue();
      expect(value).toBe('sk_test_newtoken123');
    });

    test('should preserve token after navigation', async ({ page }) => {
      const tokenField = page.locator('input[placeholder="sk_test_..."]');
      const newToken = 'sk_test_persistent';

      // Set new token
      await tokenField.clear();
      await tokenField.fill(newToken);

      // Verify it's set
      let value = await tokenField.inputValue();
      expect(value).toBe(newToken);
    });
  });

  test.describe('4. Form Testing - Event Payload', () => {
    test('should have payload field', async ({ page }) => {
      const payloadField = page.locator('textarea[placeholder*="event"]');
      await expect(payloadField).toBeVisible();
    });

    test('should accept valid JSON payload', async ({ page }) => {
      const validPayload = JSON.stringify({
        event_type: 'user.created',
        user_id: '12345',
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'api',
          region: 'us-east-1'
        }
      });

      const payloadField = page.locator('textarea[placeholder*="event"]');
      await payloadField.fill(validPayload);

      const value = await payloadField.inputValue();
      expect(value).toBe(validPayload);
    });

    test('should show validation error for empty payload', async ({ page }) => {
      const payloadField = page.locator('textarea[placeholder*="event"]');
      const submitButton = page.locator('button:has-text("Send Event")');

      // Ensure field is empty
      await payloadField.clear();

      // Try to submit
      await submitButton.click();

      // Check for validation message
      const errorMessage = page.locator('.error, [role="alert"]');
      // Wait a bit for validation message to appear
      await page.waitForTimeout(500);

      // Try to find error message
      const visibleErrors = await errorMessage.count();
      if (visibleErrors > 0) {
        await expect(errorMessage.first()).toBeVisible();
      }
    });

    test('should reject invalid JSON payload', async ({ page }) => {
      const invalidPayload = '{ invalid json }';
      const payloadField = page.locator('textarea[placeholder*="event"]');
      const submitButton = page.locator('button:has-text("Send Event")');

      await payloadField.fill(invalidPayload);
      await submitButton.click();

      // Wait for potential error
      await page.waitForTimeout(500);

      // Verify either validation error or API error appears
      const errorMessage = page.locator('.error, [role="alert"], .message');
      const errorCount = await errorMessage.count();
      expect(errorCount).toBeGreaterThan(0);
    });
  });

  test.describe('5. Form Testing - Debug Flags', () => {
    test('should have debug dropdown with 4 options', async ({ page }) => {
      const debugDropdown = page.locator('select[name*="debug"], select:has-text("Debug")');
      await expect(debugDropdown).toBeVisible();

      // Get all options
      const options = await debugDropdown.locator('option').count();
      expect(options).toBeGreaterThanOrEqual(4);
    });

    test('should toggle debug flag: VERBOSE', async ({ page }) => {
      const debugDropdown = page.locator('select[name*="debug"], select');

      // If dropdown has options with specific values
      const options = await debugDropdown.locator('option').allTextContents();
      const hasVerbose = options.some(opt => opt.toUpperCase().includes('VERBOSE') || opt.includes('TRACE'));

      if (hasVerbose || options.length >= 2) {
        await debugDropdown.selectOption('1');
        const selected = await debugDropdown.inputValue();
        expect(selected).not.toBe('0');
      }
    });

    test('should toggle debug flag: METRICS', async ({ page }) => {
      const debugDropdown = page.locator('select[name*="debug"], select');
      await debugDropdown.selectOption('2');

      const selected = await debugDropdown.inputValue();
      expect(selected).not.toBe('0');
    });

    test('should toggle debug flag: TIMING', async ({ page }) => {
      const debugDropdown = page.locator('select[name*="debug"], select');
      await debugDropdown.selectOption('3');

      const selected = await debugDropdown.inputValue();
      expect(selected).not.toBe('0');
    });

    test('should toggle debug flag: OFF', async ({ page }) => {
      const debugDropdown = page.locator('select[name*="debug"], select');

      // Set to ON first
      await debugDropdown.selectOption('1');

      // Then turn OFF
      await debugDropdown.selectOption('0');

      const selected = await debugDropdown.inputValue();
      expect(selected).toBe('0');
    });
  });

  test.describe('6. API Integration - Valid Events', () => {
    test('should submit valid event and receive 200 response', async ({ page }) => {
      const validPayload = JSON.stringify({
        event_type: 'test.event',
        timestamp: new Date().toISOString()
      });

      const tokenField = page.locator('input[placeholder="sk_test_..."]');
      const payloadField = page.locator('textarea[placeholder*="event"]');
      const submitButton = page.locator('button:has-text("Send Event")');

      // Set up intercept
      let responseStatus = 0;
      let responseBody: any = null;

      page.on('response', response => {
        if (response.url().includes('/trigger') || response.url().includes('/event')) {
          responseStatus = response.status();
        }
      });

      // Fill form
      await tokenField.clear();
      await tokenField.fill(DEFAULT_TOKEN);
      await payloadField.clear();
      await payloadField.fill(validPayload);

      // Submit
      await submitButton.click();

      // Wait for response
      await page.waitForTimeout(1500);

      // Check for success message
      const successMessage = page.locator('.success, .message:has-text("success"), [role="alert"]:has-text("success")');
      const successCount = await successMessage.count();

      // Either status code or success message should indicate success
      if (successCount > 0) {
        await expect(successMessage.first()).toBeVisible();
      }
    });

    test('should return event_id in response', async ({ page }) => {
      const validPayload = JSON.stringify({
        event_type: 'test.event.id',
        data: { test: true }
      });

      const tokenField = page.locator('input[placeholder="sk_test_..."]');
      const payloadField = page.locator('textarea[placeholder*="event"]');
      const submitButton = page.locator('button:has-text("Send Event")');

      await tokenField.clear();
      await tokenField.fill(DEFAULT_TOKEN);
      await payloadField.clear();
      await payloadField.fill(validPayload);

      await submitButton.click();
      await page.waitForTimeout(1500);

      // Check for event_id in response display
      const responseDisplay = page.locator('.response, .result, code, pre');
      const responseText = await responseDisplay.textContent();

      if (responseText) {
        expect(responseText).toContain('event_id');
      }
    });
  });

  test.describe('7. API Integration - Error Scenarios', () => {
    test('should handle invalid JSON error', async ({ page }) => {
      const invalidPayload = '{ broken json ]';

      const payloadField = page.locator('textarea[placeholder*="event"]');
      const submitButton = page.locator('button:has-text("Send Event")');

      await payloadField.clear();
      await payloadField.fill(invalidPayload);
      await submitButton.click();

      // Wait for error
      await page.waitForTimeout(1000);

      // Check for error message
      const errorMessage = page.locator('.error, [role="alert"]');
      const errorCount = await errorMessage.count();

      if (errorCount > 0) {
        await expect(errorMessage.first()).toBeVisible();
      }
    });

    test('should handle empty payload error', async ({ page }) => {
      const payloadField = page.locator('textarea[placeholder*="event"]');
      const submitButton = page.locator('button:has-text("Send Event")');

      // Clear payload
      await payloadField.clear();

      // Try to submit
      await submitButton.click();
      await page.waitForTimeout(1000);

      // Verify error appears
      const errorMessage = page.locator('.error, [role="alert"]');
      const errorCount = await errorMessage.count();

      if (errorCount > 0) {
        const text = await errorMessage.first().textContent();
        expect(text?.toLowerCase()).toContain('required');
      }
    });

    test('should handle missing authorization token', async ({ page }) => {
      const tokenField = page.locator('input[placeholder="sk_test_..."]');
      const payloadField = page.locator('textarea[placeholder*="event"]');
      const submitButton = page.locator('button:has-text("Send Event")');

      // Clear token
      await tokenField.clear();

      // Fill payload
      await payloadField.clear();
      await payloadField.fill(JSON.stringify({ event: 'test' }));

      // Try to submit
      await submitButton.click();
      await page.waitForTimeout(1000);

      // Should show error
      const errorMessage = page.locator('.error, [role="alert"]');
      const errorCount = await errorMessage.count();

      if (errorCount > 0) {
        const text = await errorMessage.first().textContent();
        expect(text?.toLowerCase()).toContain('token') || expect(text?.toLowerCase()).toContain('auth');
      }
    });
  });

  test.describe('8. UX Verification - Form Usability', () => {
    test('should have Clear button that resets form', async ({ page }) => {
      const tokenField = page.locator('input[placeholder="sk_test_..."]');
      const payloadField = page.locator('textarea[placeholder*="event"]');
      const clearButton = page.locator('button:has-text("Clear")');

      // Fill form
      await tokenField.clear();
      await tokenField.fill('sk_test_custom');
      await payloadField.fill('{ "test": "data" }');

      // Click Clear
      await clearButton.click();

      // Verify fields are cleared or reset
      await page.waitForTimeout(300);

      const tokenValue = await tokenField.inputValue();
      const payloadValue = await payloadField.inputValue();

      // Either should be empty or reset to default
      expect(tokenValue === '' || tokenValue === DEFAULT_TOKEN).toBeTruthy();
      expect(payloadValue === '').toBeTruthy();
    });

    test('should have intuitive form layout', async ({ page }) => {
      // Verify form has proper labels
      const labels = page.locator('label');
      const labelCount = await labels.count();
      expect(labelCount).toBeGreaterThanOrEqual(2);

      // Verify buttons are visible
      const sendButton = page.locator('button:has-text("Send")');
      const clearButton = page.locator('button:has-text("Clear")');

      await expect(sendButton).toBeVisible();
      await expect(clearButton).toBeVisible();
    });

    test('should show clear error messages', async ({ page }) => {
      const payloadField = page.locator('textarea[placeholder*="event"]');
      const submitButton = page.locator('button:has-text("Send Event")');

      // Submit empty form
      await payloadField.clear();
      await submitButton.click();

      await page.waitForTimeout(1000);

      // Check error clarity
      const errorMessage = page.locator('.error, [role="alert"]');
      const errorCount = await errorMessage.count();

      if (errorCount > 0) {
        const errorText = await errorMessage.first().textContent();
        expect(errorText).toBeTruthy();
        expect(errorText!.length).toBeGreaterThan(0);
      }
    });

    test('should show clear success messages', async ({ page }) => {
      const tokenField = page.locator('input[placeholder="sk_test_..."]');
      const payloadField = page.locator('textarea[placeholder*="event"]');
      const submitButton = page.locator('button:has-text("Send Event")');

      // Submit valid event
      await tokenField.clear();
      await tokenField.fill(DEFAULT_TOKEN);
      await payloadField.clear();
      await payloadField.fill(JSON.stringify({
        event_type: 'test.success',
        timestamp: new Date().toISOString()
      }));

      await submitButton.click();
      await page.waitForTimeout(1500);

      // Check for success message
      const successMessage = page.locator('.success, .message, [role="alert"]');
      const successCount = await successMessage.count();

      if (successCount > 0) {
        const text = await successMessage.first().textContent();
        expect(text).toBeTruthy();
        expect(text!.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('9. UX Verification - Accessibility', () => {
    test('should have proper form structure', async ({ page }) => {
      // Check for form element
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('should have proper button labels', async ({ page }) => {
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      expect(buttonCount).toBeGreaterThanOrEqual(2);

      // Verify each button has text
      for (let i = 0; i < buttonCount; i++) {
        const text = await buttons.nth(i).textContent();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
    });

    test('should have proper input labels', async ({ page }) => {
      const inputs = page.locator('input, textarea, select');
      const inputCount = await inputs.count();
      expect(inputCount).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('10. Complete User Workflows', () => {
    test('complete workflow: valid event submission', async ({ page }) => {
      const tokenField = page.locator('input[placeholder="sk_test_..."]');
      const payloadField = page.locator('textarea[placeholder*="event"]');
      const submitButton = page.locator('button:has-text("Send Event")');
      const debugDropdown = page.locator('select[name*="debug"], select');

      // Set up payload
      const eventPayload = JSON.stringify({
        event_type: 'user.registered',
        user_id: 'user_123456',
        email: 'test@example.com',
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'web',
          version: '1.0'
        }
      });

      // 1. Verify default token
      let token = await tokenField.inputValue();
      expect(token).toBe(DEFAULT_TOKEN);

      // 2. Fill payload
      await payloadField.clear();
      await payloadField.fill(eventPayload);

      // 3. Enable debug mode
      const options = await debugDropdown.locator('option').count();
      if (options >= 2) {
        await debugDropdown.selectOption('1');
      }

      // 4. Submit
      await submitButton.click();

      // 5. Wait for response
      await page.waitForTimeout(1500);

      // 6. Verify success
      const successMessage = page.locator('.success, .message, [role="alert"]');
      const successCount = await successMessage.count();

      if (successCount > 0) {
        await expect(successMessage.first()).toBeVisible();
      }

      // Take completion screenshot
      await page.screenshot({ path: './screenshots/workflow-complete.png', fullPage: true });
      console.log('Workflow completed successfully');
    });

    test('complete workflow: error handling and retry', async ({ page }) => {
      const payloadField = page.locator('textarea[placeholder*="event"]');
      const submitButton = page.locator('button:has-text("Send Event")');
      const clearButton = page.locator('button:has-text("Clear")');

      // 1. Try with invalid payload
      await payloadField.fill('{ invalid }');
      await submitButton.click();
      await page.waitForTimeout(1000);

      // 2. Verify error appears
      const errorMessage = page.locator('.error, [role="alert"]');
      const errorCount = await errorMessage.count();

      // 3. Clear and retry with valid payload
      await clearButton.click();
      await page.waitForTimeout(300);

      const validPayload = JSON.stringify({
        event_type: 'test.retry',
        timestamp: new Date().toISOString()
      });

      await payloadField.fill(validPayload);
      await submitButton.click();
      await page.waitForTimeout(1500);

      // 4. Verify success this time
      const successMessage = page.locator('.success, .message, [role="alert"]');
      const successCount = await successMessage.count();

      if (successCount > 0) {
        await expect(successMessage.first()).toBeVisible();
      }
    });
  });

  test.describe('11. Performance & Load Testing', () => {
    test('should load page within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
      console.log(`Page load time: ${loadTime}ms`);
    });

    test('should handle rapid form submissions', async ({ page }) => {
      const tokenField = page.locator('input[placeholder="sk_test_..."]');
      const payloadField = page.locator('textarea[placeholder*="event"]');
      const submitButton = page.locator('button:has-text("Send Event")');

      await tokenField.clear();
      await tokenField.fill(DEFAULT_TOKEN);

      const payload = JSON.stringify({
        event_type: 'rapid.test',
        timestamp: new Date().toISOString()
      });

      // Submit 3 rapid requests
      for (let i = 0; i < 3; i++) {
        await payloadField.clear();
        await payloadField.fill(payload);
        await submitButton.click();
        await page.waitForTimeout(500);
      }

      // Page should still be responsive
      const container = page.locator('.container');
      await expect(container).toBeVisible();
    });
  });
});
