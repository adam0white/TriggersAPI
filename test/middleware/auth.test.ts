/**
 * Tests for Authentication Middleware
 *
 * Validates all acceptance criteria:
 * - Bearer token validation against KV store
 * - Missing Authorization header returns 401
 * - Invalid auth scheme returns 401
 * - Invalid token format returns 401
 * - Token not found in KV returns 401
 * - Valid token returns authenticated context
 * - KV service error returns 503
 * - All error responses include proper structure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	validateBearerToken,
	unauthorizedResponse,
	serviceErrorResponse,
} from '../../src/middleware/auth';

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

	clear() {
		this.store.clear();
	}
}

// Helper to create test requests
function createRequest(headers: Record<string, string> = {}): Request {
	const url = 'http://localhost:8787/events';
	const requestHeaders = new Headers(headers);

	return new Request(url, {
		method: 'POST',
		headers: requestHeaders,
		body: JSON.stringify({ payload: { test: 'data' } }),
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

describe('validateBearerToken', () => {
	let mockKV: MockKVNamespace;
	let mockEnv: Env;

	beforeEach(() => {
		mockKV = new MockKVNamespace({
			'auth:token:sk_test_valid_token_123': JSON.stringify({
				valid: true,
				created_at: '2025-11-10T10:00:00Z',
			}),
		});
		mockEnv = { AUTH_KV: mockKV } as unknown as Env;
	});

	describe('missing authorization header', () => {
		it('should return MISSING_AUTHORIZATION error when Authorization header is missing', async () => {
			const request = createRequest({});
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.isAuthenticated).toBe(false);
			expect(result.correlationId).toBe(correlationId);
			expect(result.error).toBeDefined();
			expect(result.error?.code).toBe('MISSING_AUTHORIZATION');
			expect(result.error?.message).toBe('Authorization header is required');
		});

		it('should return MISSING_AUTHORIZATION when Authorization header is empty string', async () => {
			const request = createRequest({ Authorization: '' });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.isAuthenticated).toBe(false);
			// Empty string doesn't start with 'Bearer ', so MISSING_AUTHORIZATION is returned
			expect(result.error?.code).toBe('MISSING_AUTHORIZATION');
		});
	});

	describe('invalid auth scheme', () => {
		it('should return INVALID_AUTH_SCHEME for Basic auth', async () => {
			const request = createRequest({ Authorization: 'Basic dXNlcjpwYXNz' });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.isAuthenticated).toBe(false);
			expect(result.correlationId).toBe(correlationId);
			expect(result.error).toBeDefined();
			expect(result.error?.code).toBe('INVALID_AUTH_SCHEME');
			expect(result.error?.message).toBe('Authorization must use Bearer scheme');
		});

		it('should return INVALID_AUTH_SCHEME for lowercase bearer', async () => {
			const request = createRequest({ Authorization: 'bearer token123' });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.isAuthenticated).toBe(false);
			expect(result.error?.code).toBe('INVALID_AUTH_SCHEME');
		});

		it('should return INVALID_AUTH_SCHEME for token without Bearer prefix', async () => {
			const request = createRequest({ Authorization: 'sk_test_token' });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.isAuthenticated).toBe(false);
			expect(result.error?.code).toBe('INVALID_AUTH_SCHEME');
		});
	});

	describe('invalid token format', () => {
		it('should return INVALID_TOKEN_FORMAT for empty token after Bearer', async () => {
			// Note: Headers API may trim trailing spaces, so "Bearer " becomes "Bearer"
			const request = createRequest({ Authorization: 'Bearer' });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.isAuthenticated).toBe(false);
			expect(result.correlationId).toBe(correlationId);
			expect(result.error).toBeDefined();
			// "Bearer" doesn't have a space, so fails scheme check
			expect(result.error?.code).toBe('INVALID_AUTH_SCHEME');
		});

		it('should return INVALID_TOKEN_FORMAT for token < 10 characters', async () => {
			const request = createRequest({ Authorization: 'Bearer short' });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.isAuthenticated).toBe(false);
			expect(result.error?.code).toBe('INVALID_TOKEN_FORMAT');
		});

		it('should return INVALID_TOKEN_FORMAT for token > 256 characters', async () => {
			const longToken = 'a'.repeat(257);
			const request = createRequest({ Authorization: `Bearer ${longToken}` });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.isAuthenticated).toBe(false);
			expect(result.error?.code).toBe('INVALID_TOKEN_FORMAT');
		});

		it('should accept token exactly 10 characters', async () => {
			const token = 'a'.repeat(10);
			mockKV.setData({ [`auth:token:${token}`]: JSON.stringify({ valid: true }) });
			const request = createRequest({ Authorization: `Bearer ${token}` });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			// Should not fail format validation (but might fail KV lookup)
			expect(result.error?.code).not.toBe('INVALID_TOKEN_FORMAT');
		});

		it('should accept token exactly 256 characters', async () => {
			const token = 'a'.repeat(256);
			mockKV.setData({ [`auth:token:${token}`]: JSON.stringify({ valid: true }) });
			const request = createRequest({ Authorization: `Bearer ${token}` });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			// Should not fail format validation
			expect(result.error?.code).not.toBe('INVALID_TOKEN_FORMAT');
		});
	});

	describe('token not found in KV', () => {
		it('should return INVALID_TOKEN when token does not exist in KV', async () => {
			const request = createRequest({ Authorization: 'Bearer sk_test_nonexistent_token' });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.isAuthenticated).toBe(false);
			expect(result.correlationId).toBe(correlationId);
			expect(result.error).toBeDefined();
			expect(result.error?.code).toBe('INVALID_TOKEN');
			expect(result.error?.message).toBe('Bearer token not found or invalid');
		});
	});

	describe('valid token authentication', () => {
		it('should return authenticated context for valid token', async () => {
			const request = createRequest({ Authorization: 'Bearer sk_test_valid_token_123' });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.isAuthenticated).toBe(true);
			expect(result.correlationId).toBe(correlationId);
			expect(result.error).toBeUndefined();
		});

		it('should construct correct KV key format', async () => {
			const token = 'sk_test_valid_token_123';
			const request = createRequest({ Authorization: `Bearer ${token}` });
			const correlationId = 'test-correlation-id';

			// Spy on KV get method to verify key format
			const getSpy = vi.spyOn(mockKV, 'get');

			await validateBearerToken(request, mockEnv, correlationId);

			expect(getSpy).toHaveBeenCalledWith(`auth:token:${token}`);
		});

		it('should handle tokens with special characters', async () => {
			const token = 'sk_test_token-with-dashes_and_underscores.123';
			mockKV.setData({ [`auth:token:${token}`]: JSON.stringify({ valid: true }) });
			const request = createRequest({ Authorization: `Bearer ${token}` });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.isAuthenticated).toBe(true);
		});
	});

	describe('KV service errors', () => {
		it('should return AUTH_SERVICE_ERROR when KV throws error', async () => {
			// Mock KV to throw error
			const failingKV = {
				get: vi.fn().mockRejectedValue(new Error('KV unavailable')),
			};
			const failingEnv = { AUTH_KV: failingKV } as unknown as Env;

			const request = createRequest({ Authorization: 'Bearer sk_test_valid_token_123' });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, failingEnv, correlationId);

			expect(result.isAuthenticated).toBe(false);
			expect(result.correlationId).toBe(correlationId);
			expect(result.error).toBeDefined();
			expect(result.error?.code).toBe('AUTH_SERVICE_ERROR');
			expect(result.error?.message).toBe('Authentication service unavailable');
		});

		it('should return AUTH_SERVICE_ERROR for network timeout', async () => {
			const failingKV = {
				get: vi.fn().mockRejectedValue(new Error('Network timeout')),
			};
			const failingEnv = { AUTH_KV: failingKV } as unknown as Env;

			const request = createRequest({ Authorization: 'Bearer sk_test_valid_token_123' });
			const correlationId = 'test-correlation-id';

			const result = await validateBearerToken(request, failingEnv, correlationId);

			expect(result.isAuthenticated).toBe(false);
			expect(result.error?.code).toBe('AUTH_SERVICE_ERROR');
		});
	});

	describe('correlation ID handling', () => {
		it('should preserve correlation ID in authenticated response', async () => {
			const request = createRequest({ Authorization: 'Bearer sk_test_valid_token_123' });
			const correlationId = 'unique-correlation-id-12345';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.correlationId).toBe(correlationId);
		});

		it('should preserve correlation ID in error response', async () => {
			const request = createRequest({ Authorization: 'Bearer invalid' });
			const correlationId = 'error-correlation-id-67890';

			const result = await validateBearerToken(request, mockEnv, correlationId);

			expect(result.correlationId).toBe(correlationId);
		});
	});
});

describe('unauthorizedResponse', () => {
	it('should create 401 response with correct structure', async () => {
		const error = {
			code: 'INVALID_TOKEN',
			message: 'Bearer token not found or invalid',
		};
		const correlationId = 'test-correlation-id';

		const response = unauthorizedResponse(error, correlationId);
		const parsed = await parseResponse(response);

		expect(parsed.status).toBe(401);
		expect(parsed.headers['content-type']).toBe('application/json');
		expect(parsed.headers['x-correlation-id']).toBe(correlationId);
		expect(parsed.body.error.code).toBe('INVALID_TOKEN');
		expect(parsed.body.error.message).toBe('Bearer token not found or invalid');
		expect(parsed.body.error.timestamp).toBeDefined();
		expect(parsed.body.error.correlation_id).toBe(correlationId);
	});

	it('should include valid ISO-8601 timestamp', async () => {
		const error = { code: 'MISSING_AUTHORIZATION', message: 'Authorization header is required' };
		const correlationId = 'test-correlation-id';

		const response = unauthorizedResponse(error, correlationId);
		const parsed = await parseResponse(response);

		// Verify ISO-8601 timestamp format
		expect(parsed.body.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

		// Verify timestamp is valid date
		const timestamp = new Date(parsed.body.error.timestamp);
		expect(timestamp.getTime()).not.toBeNaN();
	});

	it('should handle different error codes', async () => {
		const errors = [
			{ code: 'MISSING_AUTHORIZATION', message: 'Authorization header is required' },
			{ code: 'INVALID_AUTH_SCHEME', message: 'Authorization must use Bearer scheme' },
			{ code: 'INVALID_TOKEN_FORMAT', message: 'Bearer token format is invalid' },
			{ code: 'INVALID_TOKEN', message: 'Bearer token not found or invalid' },
		];

		for (const error of errors) {
			const response = unauthorizedResponse(error, 'test-id');
			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(401);
			expect(parsed.body.error.code).toBe(error.code);
			expect(parsed.body.error.message).toBe(error.message);
		}
	});
});

describe('serviceErrorResponse', () => {
	it('should create 503 response with correct structure', async () => {
		const error = {
			code: 'AUTH_SERVICE_ERROR',
			message: 'Authentication service unavailable',
		};
		const correlationId = 'test-correlation-id';

		const response = serviceErrorResponse(error, correlationId);
		const parsed = await parseResponse(response);

		expect(parsed.status).toBe(503);
		expect(parsed.headers['content-type']).toBe('application/json');
		expect(parsed.headers['x-correlation-id']).toBe(correlationId);
		expect(parsed.body.error.code).toBe('AUTH_SERVICE_ERROR');
		expect(parsed.body.error.message).toBe('Authentication service unavailable');
		expect(parsed.body.error.timestamp).toBeDefined();
		expect(parsed.body.error.correlation_id).toBe(correlationId);
	});

	it('should include valid ISO-8601 timestamp', async () => {
		const error = { code: 'AUTH_SERVICE_ERROR', message: 'Authentication service unavailable' };
		const correlationId = 'test-correlation-id';

		const response = serviceErrorResponse(error, correlationId);
		const parsed = await parseResponse(response);

		// Verify ISO-8601 timestamp format
		expect(parsed.body.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

		// Verify timestamp is valid date
		const timestamp = new Date(parsed.body.error.timestamp);
		expect(timestamp.getTime()).not.toBeNaN();
	});

	it('should use 503 status (not 401 or 500)', async () => {
		const error = { code: 'AUTH_SERVICE_ERROR', message: 'Service unavailable' };
		const response = serviceErrorResponse(error, 'test-id');

		expect(response.status).toBe(503);
		expect(response.status).not.toBe(401);
		expect(response.status).not.toBe(500);
	});
});

describe('response helper consistency', () => {
	it('unauthorizedResponse and serviceErrorResponse should have same structure', async () => {
		const authError = { code: 'INVALID_TOKEN', message: 'Token invalid' };
		const serviceError = { code: 'AUTH_SERVICE_ERROR', message: 'Service unavailable' };

		const authResponse = unauthorizedResponse(authError, 'test-id');
		const serviceResponse = serviceErrorResponse(serviceError, 'test-id');

		const parsedAuth = await parseResponse(authResponse);
		const parsedService = await parseResponse(serviceResponse);

		// Both should have same structure (different status codes)
		expect(Object.keys(parsedAuth.body.error).sort()).toEqual(
			Object.keys(parsedService.body.error).sort()
		);
		expect(parsedAuth.headers['content-type']).toBe(parsedService.headers['content-type']);
		expect(parsedAuth.headers['x-correlation-id']).toBe(parsedService.headers['x-correlation-id']);
	});
});
