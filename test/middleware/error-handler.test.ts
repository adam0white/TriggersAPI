/**
 * Tests for Error Handler Middleware
 *
 * Validates:
 * - Structured error response format
 * - HTTP status codes mapping
 * - Correlation ID in responses
 * - Helper functions (badRequest, unauthorized, etc.)
 * - Error logging behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	createErrorResponse,
	handleError,
	badRequest,
	unauthorized,
	payloadTooLarge,
	internalError,
	serviceUnavailable,
} from '../../src/middleware/error-handler';

// Mock console methods to test logging
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

beforeEach(() => {
	vi.clearAllMocks();
});

// Helper to parse JSON response
async function parseResponse(response: Response) {
	const text = await response.text();
	return {
		status: response.status,
		headers: Object.fromEntries(response.headers.entries()),
		body: JSON.parse(text),
	};
}

describe('Error Handler Middleware', () => {
	describe('createErrorResponse', () => {
		it('should create structured error response with all required fields', async () => {
			const response = createErrorResponse({
				statusCode: 400,
				code: 'INVALID_PAYLOAD',
				message: 'Request body must contain payload field',
				correlationId: 'test-correlation-id',
			});

			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(400);
			expect(parsed.body.error.code).toBe('INVALID_PAYLOAD');
			expect(parsed.body.error.message).toBe('Request body must contain payload field');
			expect(parsed.body.error.correlation_id).toBe('test-correlation-id');
			expect(parsed.body.error.timestamp).toBeDefined();
			expect(parsed.body.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		});

		it('should include X-Correlation-ID header', async () => {
			const response = createErrorResponse({
				statusCode: 401,
				code: 'INVALID_TOKEN',
				message: 'Token not found',
				correlationId: 'header-test-id',
			});

			const parsed = await parseResponse(response);

			expect(parsed.headers['x-correlation-id']).toBe('header-test-id');
			expect(parsed.headers['content-type']).toBe('application/json');
		});

		it('should log error for 500 status codes', async () => {
			createErrorResponse({
				statusCode: 500,
				code: 'INTERNAL_ERROR',
				message: 'Unexpected error',
				correlationId: 'log-test-id',
			});

			expect(mockConsoleError).toHaveBeenCalled();
			const logCall = mockConsoleError.mock.calls[0][0];
			const logEntry = JSON.parse(logCall);
			expect(logEntry.level).toBe('error');
			expect(logEntry.message).toBe('Server error response');
			expect(logEntry.code).toBe('INTERNAL_ERROR');
			expect(logEntry.correlationId).toBe('log-test-id');
		});

		it('should log warning for 401 status codes', async () => {
			createErrorResponse({
				statusCode: 401,
				code: 'INVALID_TOKEN',
				message: 'Token invalid',
				correlationId: 'auth-test-id',
			});

			expect(mockConsoleWarn).toHaveBeenCalled();
			const logCall = mockConsoleWarn.mock.calls[0][0];
			const logEntry = JSON.parse(logCall);
			expect(logEntry.level).toBe('warn');
			expect(logEntry.message).toBe('Unauthorized request');
		});
	});

	describe('handleError', () => {
		it('should handle Error instances with stack traces', async () => {
			const testError = new Error('Test error message');
			const response = handleError(testError, 'error-correlation-id');

			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(500);
			expect(parsed.body.error.code).toBe('INTERNAL_ERROR');
			expect(parsed.body.error.message).toBe('An unexpected error occurred');
			expect(parsed.body.error.correlation_id).toBe('error-correlation-id');

			// Verify error was logged with stack trace
			expect(mockConsoleError).toHaveBeenCalled();
			const logCall = mockConsoleError.mock.calls[0][0];
			const logEntry = JSON.parse(logCall);
			expect(logEntry.error).toBe('Test error message');
			expect(logEntry.stack).toBeDefined();
		});

		it('should handle non-Error objects', async () => {
			const response = handleError('String error', 'string-correlation-id');

			const parsed = await parseResponse(response);

			expect(parsed.status).toBe(500);
			expect(parsed.body.error.code).toBe('INTERNAL_ERROR');
			expect(parsed.body.error.correlation_id).toBe('string-correlation-id');
		});

		it('should use custom message when provided', async () => {
			const response = handleError(new Error('Internal'), 'custom-id', 'Custom error message');

			const parsed = await parseResponse(response);

			expect(parsed.body.error.message).toBe('Custom error message');
		});
	});

	describe('helper functions', () => {
		describe('badRequest', () => {
			it('should create 400 Bad Request response', async () => {
				const response = badRequest('INVALID_PAYLOAD', 'test-id');

				const parsed = await parseResponse(response);

				expect(parsed.status).toBe(400);
				expect(parsed.body.error.code).toBe('INVALID_PAYLOAD');
				expect(parsed.body.error.message).toBe('Request body must contain payload field as JSON object');
				expect(parsed.body.error.correlation_id).toBe('test-id');
			});

			it('should accept custom message', async () => {
				const response = badRequest('INVALID_JSON', 'test-id', 'Custom bad request message');

				const parsed = await parseResponse(response);

				expect(parsed.body.error.message).toBe('Custom bad request message');
			});
		});

		describe('unauthorized', () => {
			it('should create 401 Unauthorized response', async () => {
				const response = unauthorized('INVALID_TOKEN', 'auth-id');

				const parsed = await parseResponse(response);

				expect(parsed.status).toBe(401);
				expect(parsed.body.error.code).toBe('INVALID_TOKEN');
				expect(parsed.body.error.message).toBe('Bearer token not found or invalid');
				expect(parsed.body.error.correlation_id).toBe('auth-id');
			});

			it('should accept custom message', async () => {
				const response = unauthorized('MISSING_AUTHORIZATION', 'auth-id', 'Custom auth message');

				const parsed = await parseResponse(response);

				expect(parsed.body.error.message).toBe('Custom auth message');
			});
		});

		describe('payloadTooLarge', () => {
			it('should create 413 Payload Too Large response', async () => {
				const response = payloadTooLarge('size-id');

				const parsed = await parseResponse(response);

				expect(parsed.status).toBe(413);
				expect(parsed.body.error.code).toBe('PAYLOAD_TOO_LARGE');
				expect(parsed.body.error.message).toBe('Request body exceeds maximum size of 1MB');
				expect(parsed.body.error.correlation_id).toBe('size-id');
			});

			it('should accept custom message', async () => {
				const response = payloadTooLarge('size-id', 'Custom size message');

				const parsed = await parseResponse(response);

				expect(parsed.body.error.message).toBe('Custom size message');
			});
		});

		describe('internalError', () => {
			it('should create 500 Internal Server Error response', async () => {
				const response = internalError('error-id');

				const parsed = await parseResponse(response);

				expect(parsed.status).toBe(500);
				expect(parsed.body.error.code).toBe('INTERNAL_ERROR');
				expect(parsed.body.error.message).toBe('An unexpected error occurred');
				expect(parsed.body.error.correlation_id).toBe('error-id');
			});

			it('should accept custom message', async () => {
				const response = internalError('error-id', 'Debug: Forced processing error for testing');

				const parsed = await parseResponse(response);

				expect(parsed.body.error.message).toBe('Debug: Forced processing error for testing');
			});
		});

		describe('serviceUnavailable', () => {
			it('should create 503 Service Unavailable response', async () => {
				const response = serviceUnavailable('QUEUE_SERVICE_ERROR', 'service-id');

				const parsed = await parseResponse(response);

				expect(parsed.status).toBe(503);
				expect(parsed.body.error.code).toBe('QUEUE_SERVICE_ERROR');
				expect(parsed.body.error.message).toBe('Queue service temporarily unavailable');
				expect(parsed.body.error.correlation_id).toBe('service-id');
			});

			it('should accept custom message', async () => {
				const response = serviceUnavailable('SERVICE_UNAVAILABLE', 'service-id', 'Custom service message');

				const parsed = await parseResponse(response);

				expect(parsed.body.error.message).toBe('Custom service message');
			});
		});
	});

	describe('error response structure consistency', () => {
		it('should have consistent structure across all helper functions', async () => {
			const responses = [
				await parseResponse(badRequest('INVALID_PAYLOAD', 'test-id')),
				await parseResponse(unauthorized('INVALID_TOKEN', 'test-id')),
				await parseResponse(payloadTooLarge('test-id')),
				await parseResponse(internalError('test-id')),
				await parseResponse(serviceUnavailable('SERVICE_UNAVAILABLE', 'test-id')),
			];

			for (const parsed of responses) {
				expect(parsed.body.error).toBeDefined();
				expect(parsed.body.error.code).toBeDefined();
				expect(parsed.body.error.message).toBeDefined();
				expect(parsed.body.error.timestamp).toBeDefined();
				expect(parsed.body.error.correlation_id).toBe('test-id');
				expect(parsed.headers['x-correlation-id']).toBe('test-id');
				expect(parsed.headers['content-type']).toBe('application/json');
			}
		});
	});
});
