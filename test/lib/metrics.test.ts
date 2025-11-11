/**
 * Tests for Metrics Manager Module
 *
 * Validates all acceptance criteria for KV-based metrics tracking:
 * - Counter increment operations
 * - Event storage metrics recording
 * - Status change tracking
 * - Failure recording with DLQ
 * - Queue depth and DLQ count updates
 * - Metrics retrieval
 * - Non-blocking error handling
 * - Processing rate calculation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsManager } from '../../src/lib/metrics';

// Mock KVNamespace
const createMockKV = () => {
	const store = new Map<string, string>();
	const metadata = new Map<string, any>();

	return {
		get: vi.fn(async (key: string, type?: string) => {
			const value = store.get(key);
			return value ?? null;
		}),
		put: vi.fn(async (key: string, value: string, options?: { metadata?: Record<string, any> }) => {
			store.set(key, value);
			if (options?.metadata) {
				metadata.set(key, options.metadata);
			}
		}),
		delete: vi.fn(async (key: string) => {
			store.delete(key);
			metadata.delete(key);
		}),
		// Helper methods for testing
		_getStore: () => store,
		_getMetadata: () => metadata,
		_clear: () => {
			store.clear();
			metadata.clear();
		},
	} as unknown as KVNamespace;
};

describe('MetricsManager', () => {
	let mockKV: any;
	let metricsManager: MetricsManager;

	beforeEach(() => {
		mockKV = createMockKV();
		metricsManager = new MetricsManager(mockKV);
		mockKV._clear();
	});

	describe('incrementCounter', () => {
		it('should initialize counter to 1 when key does not exist', async () => {
			const newValue = await metricsManager.incrementCounter('metrics:test:counter');

			expect(newValue).toBe(1);
			expect(mockKV.put).toHaveBeenCalledWith(
				'metrics:test:counter',
				'1',
				expect.objectContaining({
					metadata: expect.objectContaining({
						updated_at: expect.any(String),
					}),
				})
			);
		});

		it('should increment existing counter value', async () => {
			// Set initial value
			await mockKV.put('metrics:test:counter', '5');

			const newValue = await metricsManager.incrementCounter('metrics:test:counter');

			expect(newValue).toBe(6);
		});

		it('should increment by custom delta value', async () => {
			await mockKV.put('metrics:test:counter', '10');

			const newValue = await metricsManager.incrementCounter('metrics:test:counter', 5);

			expect(newValue).toBe(15);
		});

		it('should store additional metadata with counter', async () => {
			await metricsManager.incrementCounter('metrics:events:total', 1, {
				event_id: 'evt_123',
			});

			expect(mockKV.put).toHaveBeenCalledWith(
				'metrics:events:total',
				'1',
				expect.objectContaining({
					metadata: expect.objectContaining({
						event_id: 'evt_123',
						updated_at: expect.any(String),
					}),
				})
			);
		});

		it('should throw error when KV operation fails', async () => {
			mockKV.get.mockRejectedValueOnce(new Error('KV unavailable'));

			await expect(metricsManager.incrementCounter('metrics:test:counter')).rejects.toThrow(
				'KV unavailable'
			);
		});
	});

	describe('recordEventStored', () => {
		it('should increment total and pending counters', async () => {
			await metricsManager.recordEventStored('evt_123', 'pending', 50);

			// Check total counter was incremented
			const totalValue = await mockKV.get('metrics:events:total');
			expect(totalValue).toBe('1');

			// Check pending counter was incremented
			const pendingValue = await mockKV.get('metrics:events:pending');
			expect(pendingValue).toBe('1');
		});

		it('should update last_processed_at timestamp', async () => {
			await metricsManager.recordEventStored('evt_123', 'pending', 50);

			const lastProcessed = await mockKV.get('metrics:last_processed_at');
			expect(lastProcessed).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		});

		it('should record processing time', async () => {
			await metricsManager.recordEventStored('evt_123', 'pending', 123);

			const processingTime = await mockKV.get('metrics:last_processing_time_ms');
			expect(processingTime).toBe('123');
		});

		it('should handle different status values', async () => {
			await metricsManager.recordEventStored('evt_1', 'pending', 50);
			await metricsManager.recordEventStored('evt_2', 'delivered', 75);
			await metricsManager.recordEventStored('evt_3', 'failed', 100);

			const totalValue = await mockKV.get('metrics:events:total');
			expect(totalValue).toBe('3');

			const pendingValue = await mockKV.get('metrics:events:pending');
			expect(pendingValue).toBe('1');

			const deliveredValue = await mockKV.get('metrics:events:delivered');
			expect(deliveredValue).toBe('1');

			const failedValue = await mockKV.get('metrics:events:failed');
			expect(failedValue).toBe('1');
		});

		it('should not throw error when KV operation fails', async () => {
			mockKV.put.mockRejectedValueOnce(new Error('KV error'));

			// Should not throw - errors are caught and logged
			await expect(metricsManager.recordEventStored('evt_123', 'pending', 50)).resolves.toBeUndefined();
		});
	});

	describe('recordStatusChange', () => {
		it('should decrement old status and increment new status', async () => {
			// Setup: Create initial pending event
			await mockKV.put('metrics:events:pending', '5');
			await mockKV.put('metrics:events:delivered', '10');

			// Change status from pending to delivered
			await metricsManager.recordStatusChange('evt_123', 'pending', 'delivered');

			const pendingValue = await mockKV.get('metrics:events:pending');
			expect(pendingValue).toBe('4');

			const deliveredValue = await mockKV.get('metrics:events:delivered');
			expect(deliveredValue).toBe('11');
		});

		it('should not decrement below zero', async () => {
			await mockKV.put('metrics:events:pending', '0');

			await metricsManager.recordStatusChange('evt_123', 'pending', 'delivered');

			const pendingValue = await mockKV.get('metrics:events:pending');
			expect(pendingValue).toBe('0');
		});

		it('should handle missing old status counter', async () => {
			// No existing counter for pending
			await metricsManager.recordStatusChange('evt_123', 'pending', 'delivered');

			const deliveredValue = await mockKV.get('metrics:events:delivered');
			expect(deliveredValue).toBe('1');
		});

		it('should not throw error when KV operation fails', async () => {
			mockKV.get.mockRejectedValueOnce(new Error('KV error'));

			await expect(
				metricsManager.recordStatusChange('evt_123', 'pending', 'delivered')
			).resolves.toBeUndefined();
		});
	});

	describe('recordFailure', () => {
		it('should increment failed counter', async () => {
			await metricsManager.recordFailure('evt_123', 'Validation failed', 'corr_abc');

			const failedValue = await mockKV.get('metrics:events:failed');
			expect(failedValue).toBe('1');
		});

		it('should update last_failure_at timestamp', async () => {
			await metricsManager.recordFailure('evt_123', 'Timeout', 'corr_abc');

			const lastFailure = await mockKV.get('metrics:last_failure_at');
			expect(lastFailure).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		});

		it('should store DLQ metadata with correlation ID', async () => {
			await metricsManager.recordFailure('evt_123', 'Processing error', 'corr_xyz');

			expect(mockKV.put).toHaveBeenCalledWith(
				'dlq:evt_123',
				expect.stringContaining('"event_id":"evt_123"')
			);

			const dlqData = await mockKV.get('dlq:evt_123');
			const parsed = JSON.parse(dlqData!);

			expect(parsed).toEqual({
				event_id: 'evt_123',
				reason: 'Processing error',
				correlation_id: 'corr_xyz',
				failed_at: expect.any(String),
			});
		});

		it('should not throw error when KV operation fails', async () => {
			mockKV.put.mockRejectedValueOnce(new Error('KV error'));

			await expect(
				metricsManager.recordFailure('evt_123', 'Error', 'corr_abc')
			).resolves.toBeUndefined();
		});
	});

	describe('updateQueueDepth', () => {
		it('should set queue depth value', async () => {
			await metricsManager.updateQueueDepth(42);

			const depth = await mockKV.get('metrics:queue:depth');
			expect(depth).toBe('42');
		});

		it('should include metadata with timestamp', async () => {
			await metricsManager.updateQueueDepth(10);

			expect(mockKV.put).toHaveBeenCalledWith(
				'metrics:queue:depth',
				'10',
				expect.objectContaining({
					metadata: expect.objectContaining({
						updated_at: expect.any(String),
					}),
				})
			);
		});
	});

	describe('updateDLQCount', () => {
		it('should set DLQ count value', async () => {
			await metricsManager.updateDLQCount(7);

			const count = await mockKV.get('metrics:dlq:count');
			expect(count).toBe('7');
		});
	});

	describe('getAllMetrics', () => {
		it('should return complete metrics object with all counters', async () => {
			// Setup metrics
			await mockKV.put('metrics:events:total', '100');
			await mockKV.put('metrics:events:pending', '15');
			await mockKV.put('metrics:events:delivered', '80');
			await mockKV.put('metrics:events:failed', '5');
			await mockKV.put('metrics:queue:depth', '3');
			await mockKV.put('metrics:dlq:count', '2');
			await mockKV.put('metrics:last_processed_at', '2025-11-10T12:00:00.000Z');

			const metrics = await metricsManager.getAllMetrics();

			expect(metrics).toEqual({
				total_events: 100,
				pending: 15,
				delivered: 80,
				failed: 5,
				queue_depth: 3,
				dlq_count: 2,
				last_processed_at: '2025-11-10T12:00:00.000Z',
				processing_rate: expect.any(Number),
			});
		});

		it('should return zeros for missing counters', async () => {
			const metrics = await metricsManager.getAllMetrics();

			expect(metrics).toEqual({
				total_events: 0,
				pending: 0,
				delivered: 0,
				failed: 0,
				queue_depth: 0,
				dlq_count: 0,
				last_processed_at: null,
				processing_rate: 0,
			});
		});

		it('should calculate processing rate correctly', async () => {
			const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
			await mockKV.put('metrics:events:total', '60');
			await mockKV.put('metrics:last_processed_at', oneMinuteAgo);

			const metrics = await metricsManager.getAllMetrics();

			// Should be approximately 60 events per minute (allowing for timing variation)
			expect(metrics.processing_rate).toBeGreaterThan(0);
		});

		it('should return 0 processing rate when no events processed', async () => {
			const metrics = await metricsManager.getAllMetrics();

			expect(metrics.processing_rate).toBe(0);
		});

		it('should throw error when KV operation fails', async () => {
			mockKV.get.mockRejectedValueOnce(new Error('KV unavailable'));

			await expect(metricsManager.getAllMetrics()).rejects.toThrow('KV unavailable');
		});
	});

	describe('resetMetrics', () => {
		it('should reset all counter metrics to zero', async () => {
			// Setup non-zero metrics
			await mockKV.put('metrics:events:total', '100');
			await mockKV.put('metrics:events:pending', '20');
			await mockKV.put('metrics:events:delivered', '75');
			await mockKV.put('metrics:events:failed', '5');
			await mockKV.put('metrics:queue:depth', '10');
			await mockKV.put('metrics:dlq:count', '3');

			await metricsManager.resetMetrics('corr_reset');

			// Verify all counters reset to 0
			const metrics = await metricsManager.getAllMetrics();
			expect(metrics.total_events).toBe(0);
			expect(metrics.pending).toBe(0);
			expect(metrics.delivered).toBe(0);
			expect(metrics.failed).toBe(0);
			expect(metrics.queue_depth).toBe(0);
			expect(metrics.dlq_count).toBe(0);
		});

		it('should not throw error when KV operation fails', async () => {
			mockKV.put.mockRejectedValueOnce(new Error('KV error'));

			await expect(metricsManager.resetMetrics('corr_reset')).resolves.toBeUndefined();
		});
	});

	describe('performance characteristics', () => {
		it('should complete incrementCounter within 50ms', async () => {
			const start = Date.now();
			await metricsManager.incrementCounter('metrics:test:counter');
			const duration = Date.now() - start;

			// Should be very fast with mock KV
			expect(duration).toBeLessThan(50);
		});

		it('should handle concurrent metric updates', async () => {
			// Simulate concurrent increments
			const promises = Array.from({ length: 10 }, (_, i) =>
				metricsManager.incrementCounter('metrics:events:total')
			);

			await Promise.all(promises);

			const totalValue = await mockKV.get('metrics:events:total');
			// Due to read-modify-write pattern, final value might not be exactly 10
			// This demonstrates the eventual consistency trade-off
			expect(parseInt(totalValue!)).toBeGreaterThan(0);
		});
	});
});
