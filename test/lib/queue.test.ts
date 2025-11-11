/**
 * Tests for Queue Module
 *
 * Validates queue integration functionality:
 * - sendEventToQueue sends events to Cloudflare Queue
 * - QueuedEvent structure is correct
 * - Error handling for queue failures
 * - Structured logging for queue operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendEventToQueue, type QueuedEvent } from '../../src/lib/queue';

// Mock console for log verification
const consoleLogSpy = vi.spyOn(console, 'log');
const consoleErrorSpy = vi.spyOn(console, 'error');

// Mock queue
const mockQueue = {
	send: vi.fn(),
};

// Mock environment
const mockEnv = {
	EVENT_QUEUE: mockQueue,
} as unknown as Env;

beforeEach(() => {
	vi.clearAllMocks();
	mockQueue.send.mockResolvedValue(undefined);
});

describe('sendEventToQueue', () => {
	it('should send event to queue with correct structure', async () => {
		const result = await sendEventToQueue(
			mockEnv,
			'test-event-id',
			{ user_id: 123, action: 'test' },
			{ source: 'test-suite' },
			'correlation-123'
		);

		expect(result.success).toBe(true);
		expect(result.error).toBeUndefined();

		// Verify queue.send was called
		expect(mockQueue.send).toHaveBeenCalledTimes(1);

		// Verify QueuedEvent structure
		const queuedEvent: QueuedEvent = mockQueue.send.mock.calls[0][0];
		expect(queuedEvent.event_id).toBe('test-event-id');
		expect(queuedEvent.payload).toEqual({ user_id: 123, action: 'test' });
		expect(queuedEvent.metadata).toEqual({ source: 'test-suite' });
		expect(queuedEvent.timestamp).toBeDefined();
		expect(queuedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
	});

	it('should send event without metadata', async () => {
		const result = await sendEventToQueue(
			mockEnv,
			'event-no-metadata',
			{ test: 'data' },
			undefined,
			'correlation-456'
		);

		expect(result.success).toBe(true);

		const queuedEvent: QueuedEvent = mockQueue.send.mock.calls[0][0];
		expect(queuedEvent.event_id).toBe('event-no-metadata');
		expect(queuedEvent.payload).toEqual({ test: 'data' });
		expect(queuedEvent.metadata).toBeUndefined();
	});

	it('should log successful queue send', async () => {
		await sendEventToQueue(
			mockEnv,
			'log-test-event',
			{ test: 'data' },
			undefined,
			'log-correlation-id'
		);

		expect(consoleLogSpy).toHaveBeenCalledTimes(1);
		const logCall = consoleLogSpy.mock.calls[0][0];
		const logObject = JSON.parse(logCall);

		expect(logObject.level).toBe('info');
		expect(logObject.message).toBe('Event queued successfully');
		expect(logObject.event_id).toBe('log-test-event');
		expect(logObject.correlation_id).toBe('log-correlation-id');
		expect(logObject.timestamp).toBeDefined();
	});

	it('should handle queue send failure', async () => {
		mockQueue.send.mockRejectedValue(new Error('Queue is full'));

		const result = await sendEventToQueue(
			mockEnv,
			'failed-event',
			{ test: 'data' },
			undefined,
			'fail-correlation-id'
		);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Queue is full');
	});

	it('should log queue send failure', async () => {
		mockQueue.send.mockRejectedValue(new Error('Service unavailable'));

		await sendEventToQueue(
			mockEnv,
			'error-event',
			{ test: 'data' },
			undefined,
			'error-correlation-id'
		);

		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
		const errorCall = consoleErrorSpy.mock.calls[0][0];
		const errorObject = JSON.parse(errorCall);

		expect(errorObject.level).toBe('error');
		expect(errorObject.message).toBe('Failed to queue event');
		expect(errorObject.event_id).toBe('error-event');
		expect(errorObject.error).toBe('Service unavailable');
		expect(errorObject.correlation_id).toBe('error-correlation-id');
		expect(errorObject.timestamp).toBeDefined();
	});

	it('should handle non-Error exceptions', async () => {
		mockQueue.send.mockRejectedValue('String error');

		const result = await sendEventToQueue(
			mockEnv,
			'string-error-event',
			{ test: 'data' },
			undefined,
			'string-error-correlation'
		);

		expect(result.success).toBe(false);
		expect(result.error).toBe('String error');
	});

	it('should preserve complex payload structures', async () => {
		const complexPayload = {
			nested: {
				object: {
					with: 'values',
				},
			},
			array: [1, 2, 3],
			boolean: true,
			number: 42,
			nullValue: null,
		};

		await sendEventToQueue(mockEnv, 'complex-event', complexPayload, undefined, 'complex-correlation');

		const queuedEvent: QueuedEvent = mockQueue.send.mock.calls[0][0];
		expect(queuedEvent.payload).toEqual(complexPayload);
	});

	it('should create unique timestamps for each send', async () => {
		await sendEventToQueue(mockEnv, 'event-1', { test: 1 }, undefined, 'correlation-1');
		await sendEventToQueue(mockEnv, 'event-2', { test: 2 }, undefined, 'correlation-2');

		const event1: QueuedEvent = mockQueue.send.mock.calls[0][0];
		const event2: QueuedEvent = mockQueue.send.mock.calls[1][0];

		// Timestamps should be ISO-8601 format
		expect(event1.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		expect(event2.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

		// They may be the same if executed very quickly, but both should be valid
		const date1 = new Date(event1.timestamp);
		const date2 = new Date(event2.timestamp);
		expect(date1.getTime()).not.toBeNaN();
		expect(date2.getTime()).not.toBeNaN();
	});
});

describe('QueuedEvent interface', () => {
	it('should match expected structure', async () => {
		await sendEventToQueue(
			mockEnv,
			'interface-test-event',
			{ key: 'value' },
			{ meta: 'data' },
			'interface-correlation'
		);

		const queuedEvent: QueuedEvent = mockQueue.send.mock.calls[0][0];

		// Verify all required fields exist
		expect(queuedEvent).toHaveProperty('event_id');
		expect(queuedEvent).toHaveProperty('payload');
		expect(queuedEvent).toHaveProperty('metadata');
		expect(queuedEvent).toHaveProperty('timestamp');

		// Verify field types
		expect(typeof queuedEvent.event_id).toBe('string');
		expect(typeof queuedEvent.payload).toBe('object');
		expect(typeof queuedEvent.metadata).toBe('object');
		expect(typeof queuedEvent.timestamp).toBe('string');
	});
});
