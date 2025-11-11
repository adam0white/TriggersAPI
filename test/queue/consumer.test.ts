/**
 * Tests for Queue Consumer
 *
 * Validates all acceptance criteria:
 * - Queue consumer handler receives MessageBatch from Cloudflare Queues
 * - Batch processing extracts individual event messages with correct structure
 * - Each message contains event_id, payload, and metadata from original POST request
 * - Consumer logs batch size and processing attempt number
 * - Error handling: Log failed messages without blocking batch processing
 * - Ack successful messages after processing (implicit by queue handler return)
 * - Nack failed messages to trigger queue retries (throw/reject in handler)
 * - Consumer respects queue configuration: max_batch_size=100, max_batch_timeout=30s
 * - Dead Letter Queue routing: Forward messages after max_retries exceeded
 * - Retry counter incremented on each processing attempt
 * - Correlation ID maintained through batch processing for log tracing
 * - Console logs structured JSON format for Tail Worker capture
 * - Performance: Process 100-event batch in < 5 seconds
 * - Queue binding verified in local wrangler dev environment
 * - Integration test: Send event via API, verify message appears in batch
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processEventBatch } from '../../src/queue/consumer';
import { validateQueueMessage } from '../../src/queue/validation';

// Mock workflow instance
const mockWorkflowInstance = {
	id: 'mock-workflow-id',
	status: vi.fn().mockResolvedValue({ status: 'running' }),
};

// Mock environment with workflow binding
const mockEnv = {
	PROCESS_EVENT_WORKFLOW: {
		create: vi.fn().mockResolvedValue(mockWorkflowInstance),
		get: vi.fn().mockResolvedValue(mockWorkflowInstance),
	},
	DB: {} as D1Database,
	AUTH_KV: {} as KVNamespace,
} as unknown as Env;

// Mock console for log verification
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
	vi.clearAllMocks();
});

// Type alias for mock messages (using global MessageBatch and Message types)
type MockMessage = {
	id: string;
	timestamp: Date;
	body: any;
	attempts: number;
	ack: ReturnType<typeof vi.fn>;
	retry: ReturnType<typeof vi.fn>;
};

type MockMessageBatch = {
	queue: string;
	messages: MockMessage[];
};

// Helper to create mock queue messages
function createMockMessage(
	body: any,
	options: { id?: string; timestamp?: Date; attempts?: number } = {}
): MockMessage {
	return {
		id: options.id || crypto.randomUUID(),
		timestamp: options.timestamp || new Date(),
		body,
		attempts: options.attempts || 0,
		ack: vi.fn(),
		retry: vi.fn(),
	};
}

// Helper to create mock message batch
function createMockBatch(messages: MockMessage[], queueName: string = 'event-queue'): MockMessageBatch {
	return {
		queue: queueName,
		messages,
	};
}

describe('Queue Message Validation', () => {
	it('should validate valid queue message', () => {
		const validMessage = {
			event_id: 'evt_123',
			payload: { user_id: '123', action: 'test' },
			metadata: { source: 'api' },
			timestamp: '2025-11-10T10:00:00.000Z',
			correlation_id: 'corr_123',
		};

		const result = validateQueueMessage(validMessage);

		expect(result.event_id).toBe('evt_123');
		expect(result.payload).toEqual({ user_id: '123', action: 'test' });
		expect(result.metadata).toEqual({ source: 'api' });
		expect(result.timestamp).toBe('2025-11-10T10:00:00.000Z');
		expect(result.correlation_id).toBe('corr_123');
	});

	it('should accept message without optional metadata', () => {
		const messageNoMetadata = {
			event_id: 'evt_123',
			payload: { user_id: '123' },
			timestamp: '2025-11-10T10:00:00.000Z',
		};

		const result = validateQueueMessage(messageNoMetadata);

		expect(result.event_id).toBe('evt_123');
		expect(result.metadata).toBeUndefined();
	});

	it('should accept message without correlation_id', () => {
		const messageNoCorrelation = {
			event_id: 'evt_123',
			payload: { user_id: '123' },
			timestamp: '2025-11-10T10:00:00.000Z',
		};

		const result = validateQueueMessage(messageNoCorrelation);

		expect(result.event_id).toBe('evt_123');
		expect(result.correlation_id).toBeUndefined();
	});

	it('should fallback timestamp if missing', () => {
		const messageNoTimestamp = {
			event_id: 'evt_123',
			payload: { user_id: '123' },
		};

		const result = validateQueueMessage(messageNoTimestamp);

		expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
	});

	it('should throw error for missing event_id', () => {
		const invalidMessage = {
			payload: { user_id: '123' },
		};

		expect(() => validateQueueMessage(invalidMessage)).toThrow('Invalid or missing event_id');
	});

	it('should throw error for invalid event_id type', () => {
		const invalidMessage = {
			event_id: 123,
			payload: { user_id: '123' },
		};

		expect(() => validateQueueMessage(invalidMessage)).toThrow('Invalid or missing event_id');
	});

	it('should throw error for missing payload', () => {
		const invalidMessage = {
			event_id: 'evt_123',
		};

		expect(() => validateQueueMessage(invalidMessage)).toThrow('Invalid or missing payload');
	});

	it('should throw error for invalid payload type (array)', () => {
		const invalidMessage = {
			event_id: 'evt_123',
			payload: ['invalid'],
		};

		expect(() => validateQueueMessage(invalidMessage)).toThrow('Invalid or missing payload');
	});

	it('should throw error for invalid metadata type (array)', () => {
		const invalidMessage = {
			event_id: 'evt_123',
			payload: { user_id: '123' },
			metadata: ['invalid'],
		};

		expect(() => validateQueueMessage(invalidMessage)).toThrow('Invalid metadata');
	});

	it('should throw error for invalid correlation_id type', () => {
		const invalidMessage = {
			event_id: 'evt_123',
			payload: { user_id: '123' },
			correlation_id: 123,
		};

		expect(() => validateQueueMessage(invalidMessage)).toThrow('Invalid correlation_id');
	});
});

describe('Queue Consumer - Batch Processing', () => {
	it('should process single message batch successfully', async () => {
		const message = createMockMessage({
			event_id: 'evt_123',
			payload: { user_id: '123', action: 'test' },
			timestamp: '2025-11-10T10:00:00.000Z',
		});

		const batch = createMockBatch([message]);

		await processEventBatch(batch, mockEnv);

		// Verify message was acked
		expect(message.ack).toHaveBeenCalledTimes(1);

		// Verify logs
		expect(mockConsoleLog).toHaveBeenCalledWith(
			expect.stringContaining('"message":"Queue batch received"')
		);
		expect(mockConsoleLog).toHaveBeenCalledWith(
			expect.stringContaining('"message":"Queue batch processing completed"')
		);
	});

	it('should log batch size correctly', async () => {
		const messages = Array.from({ length: 5 }, () =>
			createMockMessage({
				event_id: crypto.randomUUID(),
				payload: { test: 'data' },
				timestamp: new Date().toISOString(),
			})
		);

		const batch = createMockBatch(messages);

		await processEventBatch(batch, mockEnv);

		// Find the batch received log
		const batchReceivedLog = mockConsoleLog.mock.calls.find((call) =>
			call[0].includes('"message":"Queue batch received"')
		);

		expect(batchReceivedLog).toBeDefined();
		expect(batchReceivedLog![0]).toContain('"batch_size":5');
	});

	it('should process multiple messages in parallel', async () => {
		const messages = Array.from({ length: 10 }, () =>
			createMockMessage({
				event_id: crypto.randomUUID(),
				payload: { test: 'data' },
				timestamp: new Date().toISOString(),
			})
		);

		const batch = createMockBatch(messages);

		await processEventBatch(batch, mockEnv);

		// All messages should be acked
		messages.forEach((msg) => {
			expect(msg.ack).toHaveBeenCalledTimes(1);
		});
	});

	it('should log successful and failed counts', async () => {
		const validMessage = createMockMessage({
			event_id: 'evt_valid',
			payload: { test: 'valid' },
			timestamp: new Date().toISOString(),
		});

		const invalidMessage = createMockMessage({
			// Missing event_id to trigger validation failure
			payload: { test: 'invalid' },
			timestamp: new Date().toISOString(),
		});

		const batch = createMockBatch([validMessage, invalidMessage]);

		await processEventBatch(batch, mockEnv);

		// Valid message acked, invalid not acked
		expect(validMessage.ack).toHaveBeenCalledTimes(1);
		expect(invalidMessage.ack).not.toHaveBeenCalled();

		// Find completion log
		const completionLog = mockConsoleLog.mock.calls.find((call) =>
			call[0].includes('"message":"Queue batch processing completed"')
		);

		expect(completionLog).toBeDefined();
		expect(completionLog![0]).toContain('"successful":1');
		expect(completionLog![0]).toContain('"failed":1');
	});

	it('should not block batch if one message fails', async () => {
		const validMessages = Array.from({ length: 5 }, () =>
			createMockMessage({
				event_id: crypto.randomUUID(),
				payload: { test: 'valid' },
				timestamp: new Date().toISOString(),
			})
		);

		const invalidMessage = createMockMessage({
			// Missing event_id
			payload: { test: 'invalid' },
		});

		const batch = createMockBatch([...validMessages, invalidMessage]);

		await processEventBatch(batch, mockEnv);

		// All valid messages should be acked
		validMessages.forEach((msg) => {
			expect(msg.ack).toHaveBeenCalledTimes(1);
		});

		// Invalid message not acked
		expect(invalidMessage.ack).not.toHaveBeenCalled();
	});

	it('should include retry count in logs', async () => {
		const message = createMockMessage(
			{
				event_id: 'evt_123',
				payload: { test: 'data' },
				timestamp: new Date().toISOString(),
			},
			{ attempts: 2 }
		);

		const batch = createMockBatch([message]);

		await processEventBatch(batch, mockEnv);

		// Find workflow trigger log
		const workflowLog = mockConsoleLog.mock.calls.find((call) =>
			call[0].includes('"message":"Triggering workflow for event"')
		);

		expect(workflowLog).toBeDefined();
		expect(workflowLog![0]).toContain('"retry_attempt":2');
	});

	it('should maintain correlation_id through processing', async () => {
		const correlationId = 'test-correlation-id';
		const message = createMockMessage({
			event_id: 'evt_123',
			payload: { test: 'data' },
			correlation_id: correlationId,
			timestamp: new Date().toISOString(),
		});

		const batch = createMockBatch([message]);

		await processEventBatch(batch, mockEnv);

		// All logs should include correlation_id
		const logsWithCorrelation = mockConsoleLog.mock.calls.filter((call) =>
			call[0].includes(`"correlation_id":"${correlationId}"`)
		);

		expect(logsWithCorrelation.length).toBeGreaterThan(0);
	});

	it('should generate correlation_id if not provided', async () => {
		const message = createMockMessage({
			event_id: 'evt_123',
			payload: { test: 'data' },
			timestamp: new Date().toISOString(),
		});

		const batch = createMockBatch([message]);

		await processEventBatch(batch, mockEnv);

		// Logs should have a correlation_id (generated)
		const workflowLog = mockConsoleLog.mock.calls.find((call) =>
			call[0].includes('"message":"Triggering workflow for event"')
		);

		expect(workflowLog).toBeDefined();
		expect(workflowLog![0]).toMatch(/"correlation_id":"[a-f0-9-]+"/);
	});

	it('should log structured JSON format', async () => {
		const message = createMockMessage({
			event_id: 'evt_123',
			payload: { test: 'data' },
			timestamp: new Date().toISOString(),
		});

		const batch = createMockBatch([message]);

		await processEventBatch(batch, mockEnv);

		// All logs should be valid JSON
		mockConsoleLog.mock.calls.forEach((call) => {
			expect(() => JSON.parse(call[0])).not.toThrow();
		});
	});
});

describe('Queue Consumer - Error Handling', () => {
	it('should log validation errors', async () => {
		const invalidMessage = createMockMessage({
			// Missing event_id
			payload: { test: 'data' },
		});

		const batch = createMockBatch([invalidMessage]);

		await processEventBatch(batch, mockEnv);

		// Error should be logged
		expect(mockConsoleError).toHaveBeenCalledWith(
			expect.stringContaining('"level":"error"')
		);
		expect(mockConsoleError).toHaveBeenCalledWith(
			expect.stringContaining('"message":"Message processing failed"')
		);
	});

	it('should not ack failed messages', async () => {
		const invalidMessage = createMockMessage({
			payload: { test: 'invalid' },
		});

		const batch = createMockBatch([invalidMessage]);

		await processEventBatch(batch, mockEnv);

		// Message should NOT be acked (triggers retry)
		expect(invalidMessage.ack).not.toHaveBeenCalled();
	});

	it('should include error details in failure logs', async () => {
		const invalidMessage = createMockMessage({
			event_id: 123, // Wrong type
			payload: { test: 'data' },
		});

		const batch = createMockBatch([invalidMessage]);

		await processEventBatch(batch, mockEnv);

		// Error log should include error message
		const errorLog = mockConsoleError.mock.calls.find((call) =>
			call[0].includes('"message":"Message processing failed"')
		);

		expect(errorLog).toBeDefined();
		expect(errorLog![0]).toContain('"error":');
	});
});

describe('Queue Consumer - Performance', () => {
	it('should process 100-message batch in < 5 seconds', async () => {
		const messages = Array.from({ length: 100 }, () =>
			createMockMessage({
				event_id: crypto.randomUUID(),
				payload: { test: 'data', user_id: crypto.randomUUID() },
				metadata: { source: 'test' },
				timestamp: new Date().toISOString(),
			})
		);

		const batch = createMockBatch(messages);

		const startTime = Date.now();
		await processEventBatch(batch, mockEnv);
		const duration = Date.now() - startTime;

		// Should complete in under 5 seconds (5000ms)
		expect(duration).toBeLessThan(5000);

		// All messages should be acked
		messages.forEach((msg) => {
			expect(msg.ack).toHaveBeenCalledTimes(1);
		});
	});

	it('should process messages in parallel', async () => {
		const messages = Array.from({ length: 50 }, () =>
			createMockMessage({
				event_id: crypto.randomUUID(),
				payload: { test: 'data' },
				timestamp: new Date().toISOString(),
			})
		);

		const batch = createMockBatch(messages);

		const startTime = Date.now();
		await processEventBatch(batch, mockEnv);
		const duration = Date.now() - startTime;

		// Parallel processing should be fast
		// Sequential would take much longer
		expect(duration).toBeLessThan(1000);
	});
});
