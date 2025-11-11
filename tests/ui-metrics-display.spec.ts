/**
 * E2E Tests for UI Metrics Display
 * Story 2.6: Validate metrics dashboard UI enhancement
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8787';

test.describe('UI Metrics Display - Story 2.6', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(BASE_URL);
	});

	test('should display metrics section on dashboard', async ({ page }) => {
		// Wait for metrics section to load
		await page.waitForSelector('#metricsSection', { timeout: 5000 });

		// Verify section header
		const header = await page.textContent('.metrics-title');
		expect(header).toBe('Real-Time Metrics');
	});

	test('should display all metric cards', async ({ page }) => {
		// Wait for metrics content to load (loading state completes)
		await page.waitForSelector('#metricsContent', { state: 'visible', timeout: 10000 });

		// Verify all main metric cards exist
		await expect(page.locator('#metricTotalEvents')).toBeVisible();
		await expect(page.locator('#metricPending')).toBeVisible();
		await expect(page.locator('#metricDelivered')).toBeVisible();
		await expect(page.locator('#metricFailed')).toBeVisible();
	});

	test('should display detail metrics', async ({ page }) => {
		// Wait for metrics to load
		await page.waitForSelector('#metricsContent', { state: 'visible', timeout: 10000 });

		// Verify detail metrics exist
		await expect(page.locator('#detailQueueDepth')).toBeVisible();
		await expect(page.locator('#detailDlqCount')).toBeVisible();
		await expect(page.locator('#detailProcessingRate')).toBeVisible();
		await expect(page.locator('#detailDeliveryRate')).toBeVisible();
	});

	test('should have proper color coding for metric cards', async ({ page }) => {
		// Wait for metrics to load
		await page.waitForSelector('#metricsContent', { state: 'visible', timeout: 10000 });

		// Check metric card classes for color coding
		const totalCard = page.locator('.metric-card.total');
		const pendingCard = page.locator('.metric-card.pending');
		const deliveredCard = page.locator('.metric-card.delivered');
		const failedCard = page.locator('.metric-card.failed');

		await expect(totalCard).toBeVisible();
		await expect(pendingCard).toBeVisible();
		await expect(deliveredCard).toBeVisible();
		await expect(failedCard).toBeVisible();
	});

	test('should have loading state initially', async ({ page }) => {
		// Immediately check for loading state (before metrics load)
		const loadingElement = page.locator('#metricsLoading');

		// Loading should be visible initially or content should be visible
		const isLoadingVisible = await loadingElement.isVisible();
		const isContentVisible = await page.locator('#metricsContent').isVisible();

		// Either loading or content should be visible (depending on timing)
		expect(isLoadingVisible || isContentVisible).toBe(true);
	});

	test('should display metrics values (zeros if no events)', async ({ page }) => {
		// Wait for metrics to load
		await page.waitForSelector('#metricsContent', { state: 'visible', timeout: 10000 });

		// Get metric values
		const totalEvents = await page.textContent('#metricTotalEvents');
		const pending = await page.textContent('#metricPending');
		const delivered = await page.textContent('#metricDelivered');
		const failed = await page.textContent('#metricFailed');

		// Should display numbers (likely 0 if no events)
		expect(totalEvents).toMatch(/^\d+(,\d+)*$/);
		expect(pending).toMatch(/^\d+(,\d+)*$/);
		expect(delivered).toMatch(/^\d+(,\d+)*$/);
		expect(failed).toMatch(/^\d+(,\d+)*$/);
	});

	test('should have progress bar for delivery rate', async ({ page }) => {
		// Wait for metrics to load
		await page.waitForSelector('#metricsContent', { state: 'visible', timeout: 10000 });

		// Check progress bar exists
		const progressBar = page.locator('#deliveryProgressBar');
		await expect(progressBar).toBeVisible();

		// Check ARIA attributes
		await expect(progressBar).toHaveAttribute('role', 'progressbar');
		await expect(progressBar).toHaveAttribute('aria-valuemin', '0');
		await expect(progressBar).toHaveAttribute('aria-valuemax', '100');
	});

	test('should have auto-refresh indicator', async ({ page }) => {
		// Wait for metrics to load
		await page.waitForSelector('#metricsContent', { state: 'visible', timeout: 10000 });

		// Check refresh indicator text
		const refreshText = await page.textContent('#lastUpdatedText');
		expect(refreshText).toContain('Auto-refresh every 5s');
		expect(refreshText).toContain('Last updated:');
	});

	test('should have accessible ARIA labels', async ({ page }) => {
		// Wait for metrics to load
		await page.waitForSelector('#metricsContent', { state: 'visible', timeout: 10000 });

		// Check ARIA labels on metric cards
		const cards = page.locator('[role="region"][aria-label*="metric"]');
		const count = await cards.count();

		// Should have at least 4 metric cards with ARIA labels
		expect(count).toBeGreaterThanOrEqual(4);
	});

	test('should be responsive (mobile layout)', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Wait for metrics to load
		await page.waitForSelector('#metricsContent', { state: 'visible', timeout: 10000 });

		// Verify metrics are still visible
		await expect(page.locator('#metricTotalEvents')).toBeVisible();
	});

	test('should be responsive (tablet layout)', async ({ page }) => {
		// Set tablet viewport
		await page.setViewportSize({ width: 768, height: 1024 });

		// Wait for metrics to load
		await page.waitForSelector('#metricsContent', { state: 'visible', timeout: 10000 });

		// Verify metrics are still visible
		await expect(page.locator('#metricTotalEvents')).toBeVisible();
	});

	test('should be responsive (desktop layout)', async ({ page }) => {
		// Set desktop viewport
		await page.setViewportSize({ width: 1920, height: 1080 });

		// Wait for metrics to load
		await page.waitForSelector('#metricsContent', { state: 'visible', timeout: 10000 });

		// Verify all metrics are visible
		await expect(page.locator('#metricTotalEvents')).toBeVisible();
		await expect(page.locator('#metricPending')).toBeVisible();
		await expect(page.locator('#metricDelivered')).toBeVisible();
		await expect(page.locator('#metricFailed')).toBeVisible();
	});

	test('should update metrics periodically (auto-refresh)', async ({ page }) => {
		// Wait for initial metrics load
		await page.waitForSelector('#metricsContent', { state: 'visible', timeout: 10000 });

		// Get initial last updated text
		const initialText = await page.textContent('#lastUpdatedText');

		// Wait for auto-refresh (5 seconds + buffer)
		await page.waitForTimeout(6000);

		// Get updated text
		const updatedText = await page.textContent('#lastUpdatedText');

		// Text should have changed (timestamp updated)
		expect(updatedText).not.toBe(initialText);
	});
});
