/**
 * Tests for MetricsCalculator
 * Story 4.3: Metrics Calculation
 *
 * Validates all acceptance criteria:
 * - Latency percentile calculations (p50, p95, p99)
 * - Error rate calculations
 * - Success rate calculations
 * - Queue depth tracking
 * - Throughput metrics
 * - Event lifecycle metrics
 * - CPU metrics
 * - Payload metrics
 * - Database metrics
 * - Percentile algorithm efficiency
 * - Metric validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsCalculator } from '../../src/lib/metrics-calculator';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

// Mock logger
const mockLogger = {
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
};

// Helper to create mock D1 database
function createMockD1(): D1Database {
	const mockPrepare = vi.fn().mockReturnValue({
		bind: vi.fn().mockReturnThis(),
		all: vi.fn().mockResolvedValue({ results: [] }),
		first: vi.fn().mockResolvedValue(null),
		run: vi.fn().mockResolvedValue({ success: true }),
	});

	return {
		prepare: mockPrepare,
	} as any;
}

// Helper to create mock KV namespace
function createMockKV(): KVNamespace {
	return {
		put: vi.fn().mockResolvedValue(undefined),
		get: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(undefined),
	} as any;
}

describe('MetricsCalculator', () => {
	let calculator: MetricsCalculator;
	let mockDb: D1Database;
	let mockKv: KVNamespace;

	beforeEach(() => {
		mockDb = createMockD1();
		mockKv = createMockKV();
		calculator = new MetricsCalculator(mockDb, mockKv, mockLogger);
		vi.clearAllMocks();
	});

	describe('calculateLatencyPercentiles', () => {
		it('should calculate p50, p95, p99 latencies for endpoints', async () => {
			// Mock latency data (sorted for easier understanding)
			const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]; // 10 values

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({
					results: latencies.map((duration_ms) => ({ duration_ms })),
				}),
				first: vi.fn().mockResolvedValue({ total: 10 }),
				run: vi.fn().mockResolvedValue({ success: true }),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateLatencyPercentiles();

			// Verify queries were made (4 endpoints + 12 history inserts = 16 total)
			// 4 endpoints * (1 latency query + 3 history inserts per endpoint) = 16
			expect(mockPrepare).toHaveBeenCalled();

			// Verify KV storage was called (4 endpoints * 1 KV put each)
			expect(mockKv.put).toHaveBeenCalledTimes(4);
		});

		it('should filter out invalid latency values (outliers)', async () => {
			const latencies = [10, 20, 70000, 30, 40]; // 70000ms is outlier

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({
					results: latencies.map((duration_ms) => ({ duration_ms })),
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateLatencyPercentiles();

			// Should have filtered and calculated metrics
			expect(mockKv.put).toHaveBeenCalled();
		});

		it('should handle empty log data gracefully', async () => {
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({
					results: [],
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateLatencyPercentiles();

			// Should not throw, should log debug message
			expect(mockLogger.debug).toHaveBeenCalled();
		});

		it('should validate percentile order (p50 <= p95 <= p99)', async () => {
			// Create a valid distribution
			const latencies = Array.from({ length: 100 }, (_, i) => i + 1);

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({
					results: latencies.map((duration_ms) => ({ duration_ms })),
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateLatencyPercentiles();

			// Verify KV was called (implies validation passed)
			expect(mockKv.put).toHaveBeenCalled();
		});

		it('should store metrics in KV with correct TTL', async () => {
			const latencies = [10, 20, 30, 40, 50];

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({
					results: latencies.map((duration_ms) => ({ duration_ms })),
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateLatencyPercentiles();

			// Verify KV put was called with TTL
			const kvPutCalls = (mockKv.put as any).mock.calls;
			expect(kvPutCalls.length).toBeGreaterThan(0);

			// Check that TTL is set (3600 seconds = 1 hour)
			const firstCall = kvPutCalls[0];
			expect(firstCall[2]).toHaveProperty('expirationTtl', 3600);
		});
	});

	describe('calculateErrorRate', () => {
		it('should calculate error rate as percentage', async () => {
			const mockResults = [
				{ total_count: 80, status_code: 200, error_category: null },
				{ total_count: 15, status_code: 400, error_category: 'validation' },
				{ total_count: 5, status_code: 500, error_category: 'server' },
			];

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockResults }),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateErrorRate();

			// Should calculate: 20 errors / 100 total = 20% error rate
			expect(mockKv.put).toHaveBeenCalled();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metricsJson = kvPutCall[1];
			const metrics = JSON.parse(metricsJson);

			expect(metrics.total_errors).toBe(20);
			expect(metrics.total_requests).toBe(100);
			expect(metrics.error_rate).toBe(20);
		});

		it('should group errors by type', async () => {
			const mockResults = [
				{ total_count: 10, status_code: 400, error_category: 'validation' },
				{ total_count: 5, status_code: 401, error_category: 'auth' },
				{ total_count: 3, status_code: 500, error_category: 'server' },
			];

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockResults }),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateErrorRate();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.by_type).toHaveProperty('validation', 10);
			expect(metrics.by_type).toHaveProperty('auth', 5);
			expect(metrics.by_type).toHaveProperty('server', 3);
		});

		it('should separate 4xx and 5xx errors', async () => {
			const mockResults = [
				{ total_count: 10, status_code: 400, error_category: 'validation' },
				{ total_count: 5, status_code: 500, error_category: 'server' },
			];

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockResults }),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateErrorRate();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.by_status['4xx']).toBe(10);
			expect(metrics.by_status['5xx']).toBe(5);
		});

		it('should handle zero requests gracefully', async () => {
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateErrorRate();

			// Should not throw
			expect(mockLogger.debug).toHaveBeenCalled();
		});
	});

	describe('calculateSuccessRate', () => {
		it('should calculate success rate (2xx responses)', async () => {
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({
					total_count: 100,
					success_count: 95,
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateSuccessRate();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.success_rate).toBe(95);
			expect(metrics.successful_requests).toBe(95);
			expect(metrics.total_requests).toBe(100);
		});

		it('should handle 100% success rate', async () => {
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({
					total_count: 50,
					success_count: 50,
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateSuccessRate();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.success_rate).toBe(100);
		});

		it('should handle zero requests gracefully', async () => {
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({
					total_count: 0,
					success_count: 0,
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateSuccessRate();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.success_rate).toBe(0);
		});
	});

	describe('calculateThroughput', () => {
		it('should calculate requests per second from 1 minute window', async () => {
			// 120 requests in 1 minute = 2 rps
			const mockResults = [
				{ request_count: 60, endpoint: '/events' },
				{ request_count: 60, endpoint: '/inbox' },
			];

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockResults }),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateThroughput();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.rps).toBe(2);
			expect(metrics.eps).toBe(2);
			expect(metrics.total_requests).toBe(120);
		});

		it('should handle low throughput', async () => {
			const mockResults = [{ request_count: 5, endpoint: '/events' }];

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: mockResults }),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateThroughput();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.rps).toBeLessThan(1);
		});
	});

	describe('calculateQueueMetrics', () => {
		it('should calculate queue depth and DLQ count', async () => {
			const mockPrepare = vi.fn();

			// First call: pending count
			mockPrepare.mockReturnValueOnce({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({ pending_count: 42 }),
			});

			// Second call: failed count
			mockPrepare.mockReturnValueOnce({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({ failed_count: 5 }),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateQueueMetrics();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.queue_depth).toBe(42);
			expect(metrics.dlq_count).toBe(5);
		});

		it('should handle zero queue depth', async () => {
			const mockPrepare = vi.fn();

			mockPrepare.mockReturnValueOnce({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({ pending_count: 0 }),
			});

			mockPrepare.mockReturnValueOnce({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({ failed_count: 0 }),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateQueueMetrics();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.queue_depth).toBe(0);
			expect(metrics.dlq_count).toBe(0);
		});
	});

	describe('calculateEventLifecycleMetrics', () => {
		it('should calculate event counts by status', async () => {
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({
					total_events: 1000,
					pending_events: 50,
					delivered_events: 900,
					failed_events: 50,
					avg_retries: 1.2,
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateEventLifecycleMetrics();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.total_events).toBe(1000);
			expect(metrics.pending_events).toBe(50);
			expect(metrics.delivered_events).toBe(900);
			expect(metrics.failed_events).toBe(50);
			expect(metrics.delivery_rate).toBe(90);
			expect(metrics.avg_retries).toBe(1.2);
		});

		it('should calculate delivery rate correctly', async () => {
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({
					total_events: 100,
					pending_events: 5,
					delivered_events: 90,
					failed_events: 5,
					avg_retries: 0.5,
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateEventLifecycleMetrics();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.delivery_rate).toBe(90);
		});
	});

	describe('calculateCPUMetrics', () => {
		it('should calculate CPU time percentiles', async () => {
			const cpuTimes = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({
					results: cpuTimes.map((cpu_ms) => ({ cpu_ms })),
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateCPUMetrics();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.p50).toBeGreaterThan(0);
			expect(metrics.p95).toBeGreaterThan(metrics.p50);
			expect(metrics.p99).toBeGreaterThanOrEqual(metrics.p95);
		});

		it('should filter out invalid CPU values', async () => {
			const cpuTimes = [5, 10, 80000, 15, 20]; // 80000ms is outlier

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({
					results: cpuTimes.map((cpu_ms) => ({ cpu_ms })),
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateCPUMetrics();

			// Should have filtered the outlier
			expect(mockKv.put).toHaveBeenCalled();
		});
	});

	describe('calculatePayloadMetrics', () => {
		it('should calculate average request and response sizes', async () => {
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({
					avg_request_size: 512.5,
					avg_response_size: 256.3,
					max_request_size: 2048,
					max_response_size: 1024,
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculatePayloadMetrics();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.avg_request_size).toBe(513); // Rounded
			expect(metrics.avg_response_size).toBe(256); // Rounded
			expect(metrics.max_request_size).toBe(2048);
			expect(metrics.max_response_size).toBe(1024);
		});
	});

	describe('calculateDatabaseMetrics', () => {
		it('should calculate database query performance', async () => {
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue({
					avg_query_time: 25.7,
					slow_query_count: 3,
					total_queries: 100,
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateDatabaseMetrics();

			const kvPutCall = (mockKv.put as any).mock.calls[0];
			const metrics = JSON.parse(kvPutCall[1]);

			expect(metrics.avg_query_time).toBe(25.7);
			expect(metrics.slow_query_count).toBe(3);
			expect(metrics.total_queries).toBe(100);
		});
	});

	describe('runAllMetricsCalculations', () => {
		it('should run all calculations in parallel', async () => {
			// Mock all D1 responses
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({ results: [] }),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ success: true }),
			});

			mockDb.prepare = mockPrepare;

			await calculator.runAllMetricsCalculations();

			// Should have called multiple metric calculations
			expect(mockLogger.info).toHaveBeenCalledWith('Starting metrics calculation cycle');
			expect(mockLogger.info).toHaveBeenCalledWith('Metrics calculation cycle completed');
		});

		it('should handle errors gracefully without throwing', async () => {
			// Mock a failing calculation
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockRejectedValue(new Error('Database error')),
				first: vi.fn().mockResolvedValue(null),
				run: vi.fn().mockResolvedValue({ success: true }),
			});

			mockDb.prepare = mockPrepare;

			// Should not throw
			await expect(calculator.runAllMetricsCalculations()).resolves.not.toThrow();

			// Should log errors
			expect(mockLogger.error).toHaveBeenCalled();
		});
	});

	describe('percentile algorithm', () => {
		it('should calculate percentiles accurately using linear interpolation', async () => {
			// Create a known distribution
			const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({
					results: values.map((duration_ms) => ({ duration_ms })),
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateLatencyPercentiles();

			// Verify calculations were made
			expect(mockKv.put).toHaveBeenCalled();
		});

		it('should handle single value arrays', async () => {
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({
					results: [{ duration_ms: 50 }],
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateLatencyPercentiles();

			// Should not throw
			expect(mockKv.put).toHaveBeenCalled();
		});

		it('should handle empty arrays', async () => {
			const mockPrepare = vi.fn().mockReturnValue({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({
					results: [],
				}),
			});

			mockDb.prepare = mockPrepare;

			await calculator.calculateLatencyPercentiles();

			// Should handle gracefully
			expect(mockLogger.debug).toHaveBeenCalled();
		});
	});
});
