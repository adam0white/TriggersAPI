/**
 * Tests for POST /events endpoint
 *
 * Validates all acceptance criteria:
 * - Accepts valid requests with proper structure
 * - Returns 200 with event_id, status, timestamp
 * - Returns 400 for validation failures
 * - Returns 413 for payloads exceeding 1MB
 * - Returns 400 for malformed JSON
 * - Supports debug flag for forced errors
 * - Includes correlation ID in all responses
 * - Sends events to queue after validation (Story 1.4)
 * - Returns 503 when queue is unavailable (Story 1.4)
 * - Supports debug flag ?debug=dlq_routing (Story 1.4)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handlePostEvents } from '../../src/routes/events';

// Mock queue for tests
const mockQueue = {
	send: vi.fn(),
};

// Mock environment for tests
const mockEnv = {
	EVENT_QUEUE: mockQueue,
} as unknown as Env;

// Reset queue mock before each test
beforeEach(() => {
	vi.clearAllMocks();
	mockQueue.send.mockResolvedValue(undefined);
});

// Helper to create test requests
function createRequest(
	body: any,
	options: { debug?: string; contentLength?: number; headers?: Record<string, string> } = {}
): Request {
	const url = new URL('http://localhost:8787/events');
	if (options.debug) {
		url.searchParams.set('debug', options.debug);
	}

	const headers = new Headers(options.headers || {});
	headers.set('Content-Type', 'application/json');
	if (options.contentLength !== undefined) {
		headers.set('Content-Length', String(options.contentLength));
	}

	return new Request(url.toString(), {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
	});
}

// Helper to parse JSON response
async function parseResponse(response: Response) {
	const text = await response.text();
	return {
		status: response.status,
		headers: Object.fromEntries(response.headers.entries()),
		body: JSON.parse(text),
	};
}

describe('POST /events endpoint', () => {
	describe('successful requests', () => {
		it('should accept valid request with payload only', async () => {
			const request = createRequest({
				payload: { test: 'data' },
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(200);
			expect(parsed.body.data.event_id).toBeDefined();
			expect(parsed.body.data.status).toBe('accepted');
			expect(parsed.body.data.timestamp).toBeDefined();
			expect(parsed.body.timestamp).toBeDefined();
			expect(parsed.headers['x-correlation-id']).toBe('test-correlation-id');
			expect(parsed.headers['content-type']).toBe('application/json');

			// Verify UUID v4 format (36 chars with hyphens)
			expect(parsed.body.data.event_id).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
			);

			// Verify ISO-8601 timestamp format
			expect(parsed.body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
			expect(parsed.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		});

		it('should accept valid request with payload and metadata', async () => {
			const request = createRequest({
				payload: { user_id: 123, action: 'login' },
				metadata: { event_type: 'user.login', source: 'web-app' },
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(200);
			expect(parsed.body.data.event_id).toBeDefined();
			expect(parsed.body.data.status).toBe('accepted');
		});

		it('should accept empty payload object', async () => {
			const request = createRequest({
				payload: {},
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(200);
			expect(parsed.body.data.status).toBe('accepted');
		});

		it('should generate unique event IDs for each request', async () => {
			const request1 = createRequest({ payload: { test: 1 } });
			const request2 = createRequest({ payload: { test: 2 } });

			const response1 = await handlePostEvents(request1, mockEnv, 'correlation-1');
			const response2 = await handlePostEvents(request2, mockEnv, 'correlation-2');

			const parsed1 = await parseResponse(response1);
			const parsed2 = await parseResponse(response2);

			expect(parsed1.body.data.event_id).not.toBe(parsed2.body.data.event_id);
		});
	});

	describe('validation errors', () => {
		it('should return 400 for missing payload field', async () => {
			const request = createRequest({
				metadata: { test: 'data' },
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(400);
			expect(parsed.body.error.code).toBe('INVALID_PAYLOAD');
			expect(parsed.body.error.message).toBe("Request body must contain 'payload' field");
			expect(parsed.body.error.timestamp).toBeDefined();
			expect(parsed.body.error.correlation_id).toBe('test-correlation-id');
			expect(parsed.headers['x-correlation-id']).toBe('test-correlation-id');
		});

		it('should return 400 for non-object payload', async () => {
			const request = createRequest({
				payload: 'not an object',
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(400);
			expect(parsed.body.error.code).toBe('INVALID_PAYLOAD');
			expect(parsed.body.error.message).toBe("'payload' field must be a JSON object");
		});

		it('should return 400 for array payload', async () => {
			const request = createRequest({
				payload: [1, 2, 3],
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(400);
			expect(parsed.body.error.code).toBe('INVALID_PAYLOAD');
			expect(parsed.body.error.message).toBe("'payload' field must be a JSON object");
		});

		it('should return 400 for null payload', async () => {
			const request = createRequest({
				payload: null,
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(400);
			expect(parsed.body.error.code).toBe('INVALID_PAYLOAD');
			expect(parsed.body.error.message).toBe("'payload' field must be a JSON object");
		});

		it('should return 400 for non-object metadata', async () => {
			const request = createRequest({
				payload: { test: 'data' },
				metadata: 'not an object',
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(400);
			expect(parsed.body.error.code).toBe('INVALID_PAYLOAD');
			expect(parsed.body.error.message).toBe("'metadata' field must be a JSON object");
		});

		it('should return 400 for array metadata', async () => {
			const request = createRequest({
				payload: { test: 'data' },
				metadata: [1, 2, 3],
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(400);
			expect(parsed.body.error.code).toBe('INVALID_PAYLOAD');
		});
	});

	describe('malformed JSON', () => {
		it('should return 400 for malformed JSON', async () => {
			const url = new URL('http://localhost:8787/events');
			const request = new Request(url.toString(), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: '{this is not valid json}',
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(400);
			expect(parsed.body.error.code).toBe('INVALID_JSON');
			expect(parsed.body.error.message).toBe('Request body must be valid JSON');
			expect(parsed.body.error.correlation_id).toBe('test-correlation-id');
		});

		it('should return 400 for empty request body', async () => {
			const url = new URL('http://localhost:8787/events');
			const request = new Request(url.toString(), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: '',
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(400);
			expect(parsed.body.error.code).toBe('INVALID_JSON');
		});
	});

	describe('payload size limits', () => {
		it('should return 413 when content-length exceeds 1MB', async () => {
			const request = createRequest(
				{ payload: { test: 'data' } },
				{
					contentLength: 1024 * 1024 + 1, // 1MB + 1 byte
				}
			);

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(413);
			expect(parsed.body.error.code).toBe('PAYLOAD_TOO_LARGE');
			expect(parsed.body.error.message).toBe('Request body exceeds maximum size of 1MB');
			expect(parsed.body.error.correlation_id).toBe('test-correlation-id');
		});

		it('should accept payload exactly at 1MB limit', async () => {
			const request = createRequest(
				{ payload: { test: 'data' } },
				{
					contentLength: 1024 * 1024, // Exactly 1MB
				}
			);

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(200);
			expect(parsed.body.data.status).toBe('accepted');
		});
	});

	describe('debug flags', () => {
		it('should return 400 with debug=validation_error flag', async () => {
			const request = createRequest({ payload: { test: 'data' } }, { debug: 'validation_error' });

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(400);
			expect(parsed.body.error.code).toBe('INVALID_PAYLOAD');
			expect(parsed.body.error.message).toBe('Debug: Forced validation error');
			expect(parsed.body.error.correlation_id).toBe('test-correlation-id');
		});

		it('should process normally without debug flag', async () => {
			const request = createRequest({ payload: { test: 'data' } });

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(200);
			expect(parsed.body.data.status).toBe('accepted');
		});

		it('should process normally with unrecognized debug flag', async () => {
			const request = createRequest({ payload: { test: 'data' } }, { debug: 'unknown_flag' });

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(200);
			expect(parsed.body.data.status).toBe('accepted');
		});

		it('should return 500 with debug=processing_error flag after queuing', async () => {
			const request = createRequest({ payload: { test: 'data' } }, { debug: 'processing_error' });

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			// Verify error response
			expect(parsed.status).toBe(500);
			expect(parsed.body.error.code).toBe('INTERNAL_ERROR');
			expect(parsed.body.error.message).toBe('Debug: Forced processing error for testing');
			expect(parsed.body.error.correlation_id).toBe('test-correlation-id');
			expect(parsed.body.error.timestamp).toBeDefined();

			// Verify event was still queued successfully before returning error
			expect(mockQueue.send).toHaveBeenCalledTimes(1);
			const queuedEvent = mockQueue.send.mock.calls[0][0];
			expect(queuedEvent.payload).toEqual({ test: 'data' });
		});
	});

	describe('correlation ID handling', () => {
		it('should include correlation ID in success response header', async () => {
			const request = createRequest({ payload: { test: 'data' } });

			const response = await handlePostEvents(request, mockEnv, 'my-unique-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.headers['x-correlation-id']).toBe('my-unique-correlation-id');
		});

		it('should include correlation ID in error response header', async () => {
			const request = createRequest({ payload: 'invalid' });

			const response = await handlePostEvents(request, mockEnv, 'error-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.headers['x-correlation-id']).toBe('error-correlation-id');
		});

		it('should include correlation ID in error response body', async () => {
			const request = createRequest({});

			const response = await handlePostEvents(request, mockEnv, 'body-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.body.error.correlation_id).toBe('body-correlation-id');
		});
	});

	describe('response structure', () => {
		it('should have both data.timestamp and top-level timestamp in success response', async () => {
			const request = createRequest({ payload: { test: 'data' } });

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.body.data.timestamp).toBeDefined();
			expect(parsed.body.timestamp).toBeDefined();
			expect(typeof parsed.body.data.timestamp).toBe('string');
			expect(typeof parsed.body.timestamp).toBe('string');

			// Both should be valid ISO-8601 timestamps
			const dataTimestamp = new Date(parsed.body.data.timestamp);
			const topTimestamp = new Date(parsed.body.timestamp);
			expect(dataTimestamp.getTime()).not.toBeNaN();
			expect(topTimestamp.getTime()).not.toBeNaN();
		});

		it('should have all required error response fields', async () => {
			const request = createRequest({});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.body.error).toBeDefined();
			expect(parsed.body.error.code).toBeDefined();
			expect(parsed.body.error.message).toBeDefined();
			expect(parsed.body.error.timestamp).toBeDefined();
			expect(parsed.body.error.correlation_id).toBeDefined();

			// Verify timestamp is valid ISO-8601
			const errorTimestamp = new Date(parsed.body.error.timestamp);
			expect(errorTimestamp.getTime()).not.toBeNaN();
		});

		it('should set correct Content-Type header', async () => {
			const request = createRequest({ payload: { test: 'data' } });

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');

			expect(response.headers.get('Content-Type')).toBe('application/json');
		});
	});

	describe('queue integration (Story 1.4)', () => {
		it('should send event to queue after successful validation', async () => {
			const request = createRequest({
				payload: { user_id: 123, action: 'test' },
				metadata: { source: 'test-suite' },
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			// Verify response is successful
			expect(parsed.status).toBe(200);
			expect(parsed.body.data.status).toBe('accepted');

			// Verify queue.send was called
			expect(mockQueue.send).toHaveBeenCalledTimes(1);

			// Verify queue message structure
			const queuedEvent = mockQueue.send.mock.calls[0][0];
			expect(queuedEvent.event_id).toBeDefined();
			expect(queuedEvent.event_id).toBe(parsed.body.data.event_id);
			expect(queuedEvent.payload).toEqual({ user_id: 123, action: 'test' });
			expect(queuedEvent.metadata).toEqual({ source: 'test-suite' });
			expect(queuedEvent.timestamp).toBeDefined();
			expect(queuedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		});

		it('should send event to queue without metadata', async () => {
			const request = createRequest({
				payload: { test: 'data' },
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(200);
			expect(mockQueue.send).toHaveBeenCalledTimes(1);

			const queuedEvent = mockQueue.send.mock.calls[0][0];
			expect(queuedEvent.payload).toEqual({ test: 'data' });
			expect(queuedEvent.metadata).toBeUndefined();
		});

		it('should return 503 when queue send fails', async () => {
			// Mock queue failure
			mockQueue.send.mockRejectedValue(new Error('Queue is full'));

			const request = createRequest({
				payload: { test: 'data' },
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(503);
			expect(parsed.body.error.code).toBe('QUEUE_SERVICE_ERROR');
			expect(parsed.body.error.message).toBe('Queue service temporarily unavailable');
			expect(parsed.body.error.correlation_id).toBe('test-correlation-id');
		});

		it('should handle debug flag ?debug=dlq_routing', async () => {
			const request = createRequest(
				{
					payload: { test: 'data' },
					metadata: { source: 'test' },
				},
				{ debug: 'dlq_routing' }
			);

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			// Verify response is successful with debug note
			expect(parsed.status).toBe(200);
			expect(parsed.body.data.status).toBe('accepted');
			expect(parsed.body.data.debug_note).toBe('Event forced to dead letter queue');

			// Verify queue.send was called with _force_dlq flag
			expect(mockQueue.send).toHaveBeenCalledTimes(1);
			const queuedEvent = mockQueue.send.mock.calls[0][0];
			expect(queuedEvent.payload._force_dlq).toBe(true);
		});

		it('should return 503 when DLQ routing fails', async () => {
			// Mock queue failure for DLQ
			mockQueue.send.mockRejectedValue(new Error('DLQ unavailable'));

			const request = createRequest(
				{
					payload: { test: 'data' },
				},
				{ debug: 'dlq_routing' }
			);

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(503);
			expect(parsed.body.error.code).toBe('QUEUE_SERVICE_ERROR');
		});

		it('should not send to queue if validation fails', async () => {
			const request = createRequest({
				// Missing payload field
				metadata: { test: 'data' },
			});

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(400);
			expect(mockQueue.send).not.toHaveBeenCalled();
		});

		it('should not send to queue if payload size exceeds limit', async () => {
			const request = createRequest(
				{ payload: { test: 'data' } },
				{
					contentLength: 1024 * 1024 + 1, // 1MB + 1 byte
				}
			);

			const response = await handlePostEvents(request, mockEnv, 'test-correlation-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(413);
			expect(mockQueue.send).not.toHaveBeenCalled();
		});
	});
});
