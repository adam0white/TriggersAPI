/**
 * UI Metrics Display Tests
 * Story 2.6: Validate metrics dashboard UI enhancement
 */

import { describe, it, expect } from 'vitest';

describe('UI Metrics Display - Story 2.6', () => {
	describe('HTML Structure', () => {
		it('should have metrics section in index.html', async () => {
			const fs = await import('fs/promises');
			const htmlPath = '/Users/abdul/Downloads/Projects/TriggersAPI/src/ui/index.html';
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			// Verify metrics section exists
			expect(htmlContent).toContain('id="metricsSection"');
			expect(htmlContent).toContain('Real-Time Metrics');
		});

		it('should have all required metric cards', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			// Main metrics cards
			expect(htmlContent).toContain('id="metricTotalEvents"');
			expect(htmlContent).toContain('id="metricPending"');
			expect(htmlContent).toContain('id="metricDelivered"');
			expect(htmlContent).toContain('id="metricFailed"');

			// Detail metrics
			expect(htmlContent).toContain('id="detailQueueDepth"');
			expect(htmlContent).toContain('id="detailDlqCount"');
			expect(htmlContent).toContain('id="detailProcessingRate"');
			expect(htmlContent).toContain('id="detailDeliveryRate"');
		});

		it('should have loading and error states', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain('id="metricsLoading"');
			expect(htmlContent).toContain('id="metricsError"');
			expect(htmlContent).toContain('id="metricsContent"');
			expect(htmlContent).toContain('class="btn-retry"');
		});
	});

	describe('Accessibility Features', () => {
		it('should have ARIA labels on metric cards', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain('aria-label="Total events metric"');
			expect(htmlContent).toContain('aria-label="Pending events metric"');
			expect(htmlContent).toContain('aria-label="Delivered events metric"');
			expect(htmlContent).toContain('aria-label="Failed events metric"');
		});

		it('should have ARIA attributes on progress bar', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain('role="progressbar"');
			expect(htmlContent).toContain('aria-valuenow');
			expect(htmlContent).toContain('aria-valuemin="0"');
			expect(htmlContent).toContain('aria-valuemax="100"');
			expect(htmlContent).toContain('aria-label="Delivery rate progress"');
		});

		it('should have semantic HTML structure', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain('<section class="metrics-section"');
			expect(htmlContent).toContain('role="region"');
		});
	});

	describe('Responsive Layout', () => {
		it('should have responsive grid CSS classes', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			// Check for responsive grid styling
			expect(htmlContent).toContain('metrics-grid');
			expect(htmlContent).toContain('metrics-details');
		});

		it('should have mobile-responsive CSS media queries', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain('@media (min-width: 768px)');
			expect(htmlContent).toContain('@media (min-width: 1024px)');
			expect(htmlContent).toContain('@media (max-width: 640px)');
		});
	});

	describe('Color Coding', () => {
		it('should have color-coded metric cards', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain('metric-card total');
			expect(htmlContent).toContain('metric-card pending');
			expect(htmlContent).toContain('metric-card delivered');
			expect(htmlContent).toContain('metric-card failed');
		});

		it('should have color styles for status indicators', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			// Pending: Yellow
			expect(htmlContent).toMatch(/\.pending[\s\S]*?#fef3c7|#fbbf24|#d97706/);

			// Delivered: Green
			expect(htmlContent).toMatch(/\.delivered[\s\S]*?#d1fae5|#34d399|#059669/);

			// Failed: Red
			expect(htmlContent).toMatch(/\.failed[\s\S]*?#fee2e2|#f87171|#dc2626/);

			// Total: Blue
			expect(htmlContent).toMatch(/\.total[\s\S]*?#dbeafe|#60a5fa|#2563eb/);
		});
	});

	describe('JavaScript Functionality', () => {
		it('should have fetchMetrics function', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain('async function fetchMetrics()');
			expect(htmlContent).toContain("fetch('/metrics'");
		});

		it('should have auto-refresh logic', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain('setInterval(fetchMetrics, 5000)');
			expect(htmlContent).toContain('startMetricsAutoRefresh');
			expect(htmlContent).toContain('stopMetricsAutoRefresh');
		});

		it('should have updateMetricsDisplay function', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain('function updateMetricsDisplay(metrics)');
		});

		it('should handle visibility changes (pause/resume)', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain("addEventListener('visibilitychange'");
			expect(htmlContent).toContain('document.hidden');
		});
	});

	describe('Integration with Metrics API', () => {
		it('should make GET request to /metrics endpoint', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain("fetch('/metrics'");
			expect(htmlContent).toContain("method: 'GET'");
		});

		it('should handle metrics response data structure', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			// Check for expected metric fields
			expect(htmlContent).toContain('metrics.total_events');
			expect(htmlContent).toContain('metrics.pending');
			expect(htmlContent).toContain('metrics.delivered');
			expect(htmlContent).toContain('metrics.failed');
			expect(htmlContent).toContain('metrics.queue_depth');
			expect(htmlContent).toContain('metrics.dlq_count');
			expect(htmlContent).toContain('metrics.processing_rate');
			expect(htmlContent).toContain('metrics.last_processed_at');
		});
	});

	describe('Performance', () => {
		it('should have CSS animations for smooth transitions', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain('transition:');
			expect(htmlContent).toContain('@keyframes spin');
		});

		it('should have loading spinner animation', async () => {
			const fs = await import('fs/promises');
			const path = await import('path');
			const htmlPath = path.join(process.cwd(), 'src/ui/index.html');
			const htmlContent = await fs.readFile(htmlPath, 'utf-8');

			expect(htmlContent).toContain('class="spinner"');
			expect(htmlContent).toContain('animation: spin');
		});
	});
});
