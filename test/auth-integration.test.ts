/**
 * Integration Tests for Authentication Flow
 *
 * Tests the complete authentication flow through the main Worker:
 * - POST /events requires authentication
 * - GET / does NOT require authentication
 * - All protected routes enforce auth
 * - Auth errors return proper responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';

// Mock KV namespace
class MockKVNamespace {
	private store: Map<string, string>;

	constructor(initialData: Record<string, string> = {}) {
		this.store = new Map(Object.entries(initialData));
	}

	async get(key: string): Promise<string | null> {
		return this.store.get(key) || null;
	}

	setData(data: Record<string, string>) {
		this.store = new Map(Object.entries(data));
	}
}

// Helper to create test requests
function createRequest(
	method: string,
	path: string,
	options: {
		headers?: Record<string, string>;
		body?: any;
	} = {}
): Request {
	const url = `http://localhost:8787${path}`;
	const headers = new Headers(options.headers || {});

	if (options.body) {
		headers.set('Content-Type', 'application/json');
	}

	return new Request(url, {
		method,
		headers,
		body: options.body ? JSON.stringify(options.body) : undefined,
	});
}

// Helper to parse JSON response
async function parseResponse(response: Response) {
	const text = await response.text();
	return {
		status: response.status,
		headers: Object.fromEntries(response.headers.entries()),
		body: text ? JSON.parse(text) : null,
	};
}

describe('Authentication Integration Tests', () => {
	let mockKV: MockKVNamespace;
	let mockQueue: any;
	let mockEnv: Env;
	let mockCtx: ExecutionContext;

	beforeEach(() => {
		mockKV = new MockKVNamespace({
			'auth:token:sk_test_valid_token_123': JSON.stringify({
				valid: true,
				created_at: '2025-11-10T10:00:00Z',
			}),
		});
		mockQueue = {
			send: vi.fn().mockResolvedValue(undefined),
		};
		mockEnv = { AUTH_KV: mockKV, EVENT_QUEUE: mockQueue } as unknown as Env;
		mockCtx = {
			waitUntil: vi.fn(),
			passThroughOnException: vi.fn(),
		} as unknown as ExecutionContext;
	});

	describe('GET / - Public route', () => {
		it('should allow access without authentication', async () => {
			const request = createRequest('GET', '/');

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const html = await response.text();

			expect(response.status).toBe(200);
			expect(html).toContain('<!DOCTYPE html>');
			expect(html).toContain('TriggersAPI');
			expect(html).toContain('Event Ingestion Dashboard');
			expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
		});

		it('should work with valid token (but token not required)', async () => {
			const request = createRequest('GET', '/', {
				headers: { Authorization: 'Bearer sk_test_valid_token_123' },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const html = await response.text();

			expect(response.status).toBe(200);
			expect(html).toContain('<!DOCTYPE html>');
			expect(html).toContain('TriggersAPI');
		});

		it('should work with invalid token (token not checked for public routes)', async () => {
			const request = createRequest('GET', '/', {
				headers: { Authorization: 'Bearer invalid_token' },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const html = await response.text();

			expect(response.status).toBe(200);
			expect(html).toContain('<!DOCTYPE html>');
			expect(html).toContain('TriggersAPI');
		});
	});

	describe('POST /events - Protected route', () => {
		it('should return 401 when no Authorization header provided', async () => {
			const request = createRequest('POST', '/events', {
				body: { payload: { test: 'data' } },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(401);
			expect(parsed.body.error.code).toBe('MISSING_AUTHORIZATION');
			expect(parsed.body.error.message).toBe('Authorization header is required');
			expect(parsed.body.error.timestamp).toBeDefined();
			expect(parsed.body.error.correlation_id).toBeDefined();
			expect(parsed.headers['x-correlation-id']).toBeDefined();
		});

		it('should return 401 for invalid auth scheme', async () => {
			const request = createRequest('POST', '/events', {
				headers: { Authorization: 'Basic dXNlcjpwYXNz' },
				body: { payload: { test: 'data' } },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(401);
			expect(parsed.body.error.code).toBe('INVALID_AUTH_SCHEME');
			expect(parsed.body.error.message).toBe('Authorization must use Bearer scheme');
		});

		it('should return 401 for malformed Bearer token', async () => {
			const request = createRequest('POST', '/events', {
				headers: { Authorization: 'Bearer short' },
				body: { payload: { test: 'data' } },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(401);
			expect(parsed.body.error.code).toBe('INVALID_TOKEN_FORMAT');
			expect(parsed.body.error.message).toBe('Bearer token format is invalid');
		});

		it('should return 401 for token not found in KV', async () => {
			const request = createRequest('POST', '/events', {
				headers: { Authorization: 'Bearer sk_test_nonexistent_token' },
				body: { payload: { test: 'data' } },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(401);
			expect(parsed.body.error.code).toBe('INVALID_TOKEN');
			expect(parsed.body.error.message).toBe('Bearer token not found or invalid');
		});

		it('should return 200 for valid Bearer token', async () => {
			const request = createRequest('POST', '/events', {
				headers: { Authorization: 'Bearer sk_test_valid_token_123' },
				body: { payload: { test: 'data' } },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(200);
			expect(parsed.body.data.event_id).toBeDefined();
			expect(parsed.body.data.status).toBe('accepted');
			expect(parsed.body.data.timestamp).toBeDefined();
		});

		it('should return 503 when KV service fails', async () => {
			const failingKV = {
				get: vi.fn().mockRejectedValue(new Error('KV unavailable')),
			};
			const failingEnv = { AUTH_KV: failingKV } as unknown as Env;

			const request = createRequest('POST', '/events', {
				headers: { Authorization: 'Bearer sk_test_valid_token_123' },
				body: { payload: { test: 'data' } },
			});

			const response = await worker.fetch(request, failingEnv, mockCtx);
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(503);
			expect(parsed.body.error.code).toBe('AUTH_SERVICE_ERROR');
			expect(parsed.body.error.message).toBe('Authentication service unavailable');
		});
	});

	describe('Correlation ID handling', () => {
		it('should use provided correlation ID in auth error response', async () => {
			const request = createRequest('POST', '/events', {
				headers: {
					'x-correlation-id': 'custom-correlation-id-12345',
				},
				body: { payload: { test: 'data' } },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(401);
			expect(parsed.body.error.correlation_id).toBe('custom-correlation-id-12345');
			expect(parsed.headers['x-correlation-id']).toBe('custom-correlation-id-12345');
		});

		it('should generate correlation ID if not provided', async () => {
			const request = createRequest('POST', '/events', {
				body: { payload: { test: 'data' } },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const parsed = await parseResponse(response);

			expect(parsed.body.error.correlation_id).toBeDefined();
			expect(parsed.headers['x-correlation-id']).toBeDefined();

			// Verify UUID v4 format
			expect(parsed.body.error.correlation_id).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
			);
		});
	});

	describe('Auth error precedence', () => {
		it('should check missing header before token validation', async () => {
			const request = createRequest('POST', '/events', {
				body: { payload: { test: 'data' } },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const parsed = await parseResponse(response);

			// Should fail on missing auth, not on token lookup
			expect(parsed.body.error.code).toBe('MISSING_AUTHORIZATION');
		});

		it('should check auth scheme before token format', async () => {
			const request = createRequest('POST', '/events', {
				headers: { Authorization: 'Basic short' },
				body: { payload: { test: 'data' } },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const parsed = await parseResponse(response);

			// Should fail on invalid scheme, not on token format
			expect(parsed.body.error.code).toBe('INVALID_AUTH_SCHEME');
		});

		it('should check token format before KV lookup', async () => {
			const request = createRequest('POST', '/events', {
				headers: { Authorization: 'Bearer x' },
				body: { payload: { test: 'data' } },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const parsed = await parseResponse(response);

			// Should fail on token format, not attempt KV lookup
			expect(parsed.body.error.code).toBe('INVALID_TOKEN_FORMAT');
		});
	});

	describe('Auth happens before request validation', () => {
		it('should return 401 before validating request body', async () => {
			const request = createRequest('POST', '/events', {
				body: { invalid: 'payload structure' },
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const parsed = await parseResponse(response);

			// Auth should fail before payload validation
			expect(parsed.status).toBe(401);
			expect(parsed.body.error.code).toBe('MISSING_AUTHORIZATION');
		});

		it('should return 401 before processing malformed JSON', async () => {
			const url = 'http://localhost:8787/events';
			const request = new Request(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: '{invalid json}',
			});

			const response = await worker.fetch(request, mockEnv, mockCtx);
			const parsed = await parseResponse(response);

			// Auth should fail before JSON parsing
			expect(parsed.status).toBe(401);
			expect(parsed.body.error.code).toBe('MISSING_AUTHORIZATION');
		});
	});

	describe('Response structure consistency', () => {
		it('should have consistent error structure for all auth errors', async () => {
			const testCases = [
				{ headers: {}, expectedCode: 'MISSING_AUTHORIZATION' },
				{ headers: { Authorization: 'Basic test' }, expectedCode: 'INVALID_AUTH_SCHEME' },
				{ headers: { Authorization: 'Bearer x' }, expectedCode: 'INVALID_TOKEN_FORMAT' },
				{
					headers: { Authorization: 'Bearer sk_test_invalid' },
					expectedCode: 'INVALID_TOKEN',
				},
			];

			for (const testCase of testCases) {
				const request = createRequest('POST', '/events', {
					headers: testCase.headers,
					body: { payload: { test: 'data' } },
				});

				const response = await worker.fetch(request, mockEnv, mockCtx);
				const parsed = await parseResponse(response);

				// All auth errors should have same structure
				expect(parsed.body.error.code).toBe(testCase.expectedCode);
				expect(parsed.body.error.message).toBeDefined();
				expect(parsed.body.error.timestamp).toBeDefined();
				expect(parsed.body.error.correlation_id).toBeDefined();
				expect(Object.keys(parsed.body.error).sort()).toEqual([
					'code',
					'correlation_id',
					'message',
					'timestamp',
				]);
			}
		});
	});
});
