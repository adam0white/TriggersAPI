/**
 * Tests for Log Batch Processor
 *
 * Validates all acceptance criteria for batch processing:
 * - Batch processing efficiency (100+ logs per batch)
 * - Periodic flush (5 second interval)
 * - Immediate flush when buffer full
 * - Retry logic for failed inserts
 * - Data consistency
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LogBatchProcessor } from '../../src/lib/log-batch-processor';
import type { ParsedLog } from '../../src/lib/log-parser';

describe('LogBatchProcessor', () => {
	let mockDb: any;
	let mockLogger: any;
	let processor: LogBatchProcessor;

	beforeEach(() => {
		// Mock D1 database
		mockDb = {
			prepare: vi.fn().mockReturnThis(),
			bind: vi.fn().mockReturnThis(),
			run: vi.fn().mockResolvedValue({ success: true }),
			batch: vi.fn().mockResolvedValue([{ success: true }]),
		};

		// Mock logger
		mockLogger = {
			info: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
		};
	});

	afterEach(() => {
		vi.clearAllTimers();
	});

	describe('Basic Functionality', () => {
		it('should add log to buffer', async () => {
			processor = new LogBatchProcessor(mockDb, mockLogger);
			const log = createMockLog();

			await processor.addLog(log);

			expect(processor.getBufferSize()).toBe(1);
		});

		it('should add multiple logs to buffer', async () => {
			processor = new LogBatchProcessor(mockDb, mockLogger);
			const logs = [createMockLog(), createMockLog(), createMockLog()];

			await processor.addLogs(logs);

			expect(processor.getBufferSize()).toBe(3);
		});
	});

	describe('Batch Size Limit', () => {
		it('should flush when buffer reaches max batch size', async () => {
			processor = new LogBatchProcessor(mockDb, mockLogger, {
				maxBatchSize: 2,
			});

			await processor.addLog(createMockLog());
			expect(processor.getBufferSize()).toBe(1);
			expect(mockDb.batch).not.toHaveBeenCalled();

			await processor.addLog(createMockLog());

			// Should have flushed automatically
			expect(processor.getBufferSize()).toBe(0);
			expect(mockDb.batch).toHaveBeenCalledTimes(1);
		});

		it('should handle batches of 100+ logs', async () => {
			processor = new LogBatchProcessor(mockDb, mockLogger, {
				maxBatchSize: 150,
			});

			const logs = Array.from({ length: 150 }, () => createMockLog());
			await processor.addLogs(logs);

			// Should flush automatically
			expect(processor.getBufferSize()).toBe(0);
			expect(mockDb.batch).toHaveBeenCalledTimes(1);

			// Verify batch size
			const batchCall = mockDb.batch.mock.calls[0][0];
			expect(batchCall.length).toBe(150);
		});
	});

	describe('Periodic Flush', () => {
		it('should schedule periodic flush', async () => {
			vi.useFakeTimers();

			processor = new LogBatchProcessor(mockDb, mockLogger, {
				flushIntervalMs: 1000,
			});

			await processor.addLog(createMockLog());
			expect(processor.getBufferSize()).toBe(1);
			expect(mockDb.batch).not.toHaveBeenCalled();

			// Fast-forward time by 1 second
			vi.advanceTimersByTime(1000);

			// Wait for async flush to complete
			await vi.runAllTimersAsync();

			expect(processor.getBufferSize()).toBe(0);
			expect(mockDb.batch).toHaveBeenCalledTimes(1);

			vi.useRealTimers();
		});

		it('should not schedule multiple flushes', async () => {
			vi.useFakeTimers();

			processor = new LogBatchProcessor(mockDb, mockLogger, {
				flushIntervalMs: 1000,
			});

			await processor.addLog(createMockLog());
			await processor.addLog(createMockLog());
			await processor.addLog(createMockLog());

			// Fast-forward time
			vi.advanceTimersByTime(1000);
			await vi.runAllTimersAsync();

			// Should only flush once
			expect(mockDb.batch).toHaveBeenCalledTimes(1);

			vi.useRealTimers();
		});
	});

	describe('Manual Flush', () => {
		it('should flush all buffered logs', async () => {
			processor = new LogBatchProcessor(mockDb, mockLogger);

			await processor.addLogs([createMockLog(), createMockLog(), createMockLog()]);
			expect(processor.getBufferSize()).toBe(3);

			await processor.flush();

			expect(processor.getBufferSize()).toBe(0);
			expect(mockDb.batch).toHaveBeenCalledTimes(1);
		});

		it('should not flush when buffer is empty', async () => {
			processor = new LogBatchProcessor(mockDb, mockLogger);

			await processor.flush();

			expect(mockDb.batch).not.toHaveBeenCalled();
		});

		it('should prevent concurrent flushes', async () => {
			processor = new LogBatchProcessor(mockDb, mockLogger);

			// Add logs
			await processor.addLogs([createMockLog(), createMockLog()]);

			// Trigger multiple flushes concurrently
			const flush1 = processor.flush();
			const flush2 = processor.flush();
			const flush3 = processor.flush();

			await Promise.all([flush1, flush2, flush3]);

			// Should only execute batch once
			expect(mockDb.batch).toHaveBeenCalledTimes(1);
		});
	});

	describe('Retry Logic', () => {
		it('should retry on failure', async () => {
			mockDb.batch
				.mockRejectedValueOnce(new Error('Network error'))
				.mockRejectedValueOnce(new Error('Network error'))
				.mockResolvedValueOnce([{ success: true }]);

			processor = new LogBatchProcessor(mockDb, mockLogger, {
				maxRetries: 3,
			});

			await processor.addLog(createMockLog());
			await processor.flush();

			// Should have retried 2 times before success
			expect(mockDb.batch).toHaveBeenCalledTimes(3);
			expect(mockLogger.warn).toHaveBeenCalledTimes(2);
			expect(mockLogger.info).toHaveBeenCalledTimes(1);
		});

		it('should fail after max retries', async () => {
			mockDb.batch.mockRejectedValue(new Error('Persistent error'));

			processor = new LogBatchProcessor(mockDb, mockLogger, {
				maxRetries: 2,
			});

			await processor.addLog(createMockLog());
			await processor.flush();

			// Should have tried 3 times (initial + 2 retries)
			expect(mockDb.batch).toHaveBeenCalledTimes(3);
			expect(mockLogger.error).toHaveBeenCalledTimes(1);
		});
	});

	describe('Data Consistency', () => {
		it('should insert logs with all required fields', async () => {
			processor = new LogBatchProcessor(mockDb, mockLogger);

			const log = createMockLog({
				method: 'POST',
				path: '/events',
				status_code: 201,
			});

			await processor.addLog(log);
			await processor.flush();

			expect(mockDb.batch).toHaveBeenCalledTimes(1);

			// Verify prepared statement was called
			expect(mockDb.prepare).toHaveBeenCalled();
		});

		it('should handle null optional fields', async () => {
			processor = new LogBatchProcessor(mockDb, mockLogger);

			const log = createMockLog({
				error_code: null,
				error_message: null,
				error_category: null,
				debug_flag: null,
			});

			await processor.addLog(log);
			await processor.flush();

			expect(mockDb.batch).toHaveBeenCalledTimes(1);
		});
	});

	describe('Performance', () => {
		it('should complete batch insert in reasonable time', async () => {
			processor = new LogBatchProcessor(mockDb, mockLogger);

			const logs = Array.from({ length: 100 }, () => createMockLog());

			const startTime = Date.now();
			await processor.addLogs(logs);
			await processor.flush();
			const duration = Date.now() - startTime;

			// Should complete in less than 500ms
			expect(duration).toBeLessThan(500);
		});
	});
});

/**
 * Helper function to create mock ParsedLog
 */
function createMockLog(overrides: Partial<ParsedLog> = {}): ParsedLog {
	return {
		log_id: crypto.randomUUID(),
		correlation_id: crypto.randomUUID(),
		request_id: null,
		timestamp: new Date().toISOString(),
		method: 'GET',
		path: '/events',
		endpoint: '/events',
		query_params: null,
		request_headers: null,
		request_body_size: 0,
		status_code: 200,
		status_class: '2xx',
		response_headers: null,
		response_body_size: 0,
		duration_ms: 10,
		cpu_ms: 5,
		db_query_ms: null,
		queue_wait_ms: null,
		error_code: null,
		error_message: null,
		error_category: null,
		error_stack: null,
		worker_name: 'test-worker',
		debug_flag: null,
		environment: 'test',
		version: '1.0.0',
		...overrides,
	};
}
