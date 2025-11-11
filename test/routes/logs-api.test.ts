/**
 * Tests for GET /api/logs endpoint
 *
 * Validates all acceptance criteria for Story 4.4:
 * - GET /api/logs endpoint implemented and accessible
 * - Accepts log level filter (debug|info|warn|error)
 * - Accepts worker name filter
 * - Accepts endpoint filter
 * - Accepts search parameter (message or correlation_id)
 * - Accepts limit parameter (default 50, max 500)
 * - Returns logs ordered by timestamp DESC (newest first)
 * - Returns logs from last 1 hour only
 * - Query builder constructs WHERE clauses correctly
 * - Returns logs array with all fields
 * - Response includes count of returned logs
 * - Response includes timestamp
 * - Handles missing filters (returns all logs)
 * - Handles empty result set gracefully
 * - Public endpoint (no authentication required)
 * - Returns standard API format
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleGetLogs } from '../../src/routes/logs-api';

// Mock D1 database
const mockD1 = {
	prepare: vi.fn(),
};

// Mock KV namespace
const mockKV = {
	get: vi.fn(),
	put: vi.fn(),
};

// Mock environment
const mockEnv = {
	DB: mockD1,
	METRICS_KV: mockKV,
} as unknown as Env;

// Helper to create test requests
function createRequest(queryParams: Record<string, string> = {}): Request {
	const url = new URL('http://localhost:8787/api/logs');
	Object.entries(queryParams).forEach(([key, value]) => {
		url.searchParams.set(key, value);
	});

	return new Request(url.toString(), {
		method: 'GET',
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

// Mock prepared statement
function createMockPreparedStatement(returnValue: any) {
	const statement = {
		bind: vi.fn().mockReturnThis(),
		all: vi.fn().mockResolvedValue({ results: returnValue }),
		first: vi.fn().mockResolvedValue(returnValue),
	};
	return statement;
}

describe('GET /api/logs endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('successful queries', () => {
		it('should return all logs when no filters provided', async () => {
			const mockLogs = [
				{
					log_id: 'log-1',
					correlation_id: 'corr-1',
					timestamp: '2025-11-11T10:00:00Z',
					log_level: 'info',
					message: 'Request received',
					method: 'POST',
					path: '/events',
					endpoint: '/events',
					status_code: 200,
					status_class: '2xx',
					duration_ms: 45,
					worker_name: 'api-worker',
					created_at: '2025-11-11T10:00:00Z',
				},
				{
					log_id: 'log-2',
					correlation_id: 'corr-2',
					timestamp: '2025-11-11T09:59:00Z',
					log_level: 'error',
					message: 'Validation failed',
					method: 'POST',
					path: '/events',
					endpoint: '/events',
					status_code: 400,
					status_class: '4xx',
					duration_ms: 12,
					error_code: 'INVALID_PAYLOAD',
					error_message: 'Missing required field: payload',
					error_category: 'validation',
					worker_name: 'api-worker',
					created_at: '2025-11-11T09:59:00Z',
				},
			];

			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest();
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');
			const result = await parseResponse(response);

			expect(result.status).toBe(200);
			expect(result.body.logs).toHaveLength(2);
			expect(result.body.count).toBe(2);
			expect(result.body.timestamp).toBeDefined();
			expect(result.headers['x-correlation-id']).toBe('test-correlation-id');

			// Verify query was called correctly
			expect(mockD1.prepare).toHaveBeenCalledWith(expect.stringContaining('FROM log_entries'));
			expect(mockD1.prepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY timestamp DESC'));
		});

		it('should filter logs by log level', async () => {
			const mockLogs = [
				{
					log_id: 'log-1',
					correlation_id: 'corr-1',
					timestamp: '2025-11-11T10:00:00Z',
					log_level: 'error',
					message: 'Error occurred',
					worker_name: 'api-worker',
					created_at: '2025-11-11T10:00:00Z',
				},
			];

			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest({ level: 'error' });
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');
			const result = await parseResponse(response);

			expect(result.status).toBe(200);
			expect(result.body.logs).toHaveLength(1);
			expect(result.body.logs[0].log_level).toBe('error');

			// Verify log level filter was applied
			expect(mockD1.prepare).toHaveBeenCalledWith(expect.stringContaining('log_level = ?'));
			expect(mockStatement.bind).toHaveBeenCalledWith('error', 50);
		});

		it('should filter logs by worker name', async () => {
			const mockLogs = [
				{
					log_id: 'log-1',
					correlation_id: 'corr-1',
					timestamp: '2025-11-11T10:00:00Z',
					log_level: 'info',
					message: 'Processing event',
					worker_name: 'queue-consumer',
					created_at: '2025-11-11T10:00:00Z',
				},
			];

			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest({ worker: 'queue-consumer' });
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');
			const result = await parseResponse(response);

			expect(result.status).toBe(200);
			expect(result.body.logs).toHaveLength(1);
			expect(result.body.logs[0].worker_name).toBe('queue-consumer');

			// Verify worker filter was applied
			expect(mockD1.prepare).toHaveBeenCalledWith(expect.stringContaining('worker_name = ?'));
			expect(mockStatement.bind).toHaveBeenCalledWith('queue-consumer', 50);
		});

		it('should filter logs by endpoint', async () => {
			const mockLogs = [
				{
					log_id: 'log-1',
					correlation_id: 'corr-1',
					timestamp: '2025-11-11T10:00:00Z',
					log_level: 'info',
					message: 'Request processed',
					endpoint: '/events',
					worker_name: 'api-worker',
					created_at: '2025-11-11T10:00:00Z',
				},
			];

			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest({ endpoint: '/events' });
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');
			const result = await parseResponse(response);

			expect(result.status).toBe(200);
			expect(result.body.logs).toHaveLength(1);
			expect(result.body.logs[0].endpoint).toBe('/events');

			// Verify endpoint filter was applied
			expect(mockD1.prepare).toHaveBeenCalledWith(expect.stringContaining('endpoint = ?'));
			expect(mockStatement.bind).toHaveBeenCalledWith('/events', 50);
		});

		it('should search logs by message or correlation ID', async () => {
			const mockLogs = [
				{
					log_id: 'log-1',
					correlation_id: 'abc-123-def',
					timestamp: '2025-11-11T10:00:00Z',
					log_level: 'info',
					message: 'Request with correlation ID abc-123-def',
					worker_name: 'api-worker',
					created_at: '2025-11-11T10:00:00Z',
				},
			];

			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest({ search: 'abc-123' });
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');
			const result = await parseResponse(response);

			expect(result.status).toBe(200);
			expect(result.body.logs).toHaveLength(1);

			// Verify search filter was applied
			expect(mockD1.prepare).toHaveBeenCalledWith(expect.stringContaining('message LIKE ? OR correlation_id LIKE ?'));
			expect(mockStatement.bind).toHaveBeenCalledWith('%abc-123%', '%abc-123%', 50);
		});

		it('should respect custom limit parameter', async () => {
			const mockLogs = Array.from({ length: 100 }, (_, i) => ({
				log_id: `log-${i}`,
				correlation_id: `corr-${i}`,
				timestamp: '2025-11-11T10:00:00Z',
				log_level: 'info',
				message: `Message ${i}`,
				worker_name: 'api-worker',
				created_at: '2025-11-11T10:00:00Z',
			}));

			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest({ limit: '100' });
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');
			const result = await parseResponse(response);

			expect(result.status).toBe(200);

			// Verify limit was applied
			expect(mockStatement.bind).toHaveBeenCalledWith(100);
		});

		it('should enforce maximum limit of 500', async () => {
			const mockLogs: any[] = [];
			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest({ limit: '1000' });
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');

			// Verify max limit of 500 was enforced
			expect(mockStatement.bind).toHaveBeenCalledWith(500);
		});

		it('should use default limit of 50 when not specified', async () => {
			const mockLogs: any[] = [];
			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest();
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');

			// Verify default limit of 50 was used
			expect(mockStatement.bind).toHaveBeenCalledWith(50);
		});

		it('should combine multiple filters', async () => {
			const mockLogs = [
				{
					log_id: 'log-1',
					correlation_id: 'corr-1',
					timestamp: '2025-11-11T10:00:00Z',
					log_level: 'error',
					message: 'Database query failed',
					endpoint: '/events',
					worker_name: 'api-worker',
					created_at: '2025-11-11T10:00:00Z',
				},
			];

			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest({
				level: 'error',
				worker: 'api-worker',
				endpoint: '/events',
			});

			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');
			const result = await parseResponse(response);

			expect(result.status).toBe(200);
			expect(result.body.logs).toHaveLength(1);

			// Verify all filters were applied
			expect(mockD1.prepare).toHaveBeenCalledWith(expect.stringContaining('log_level = ?'));
			expect(mockD1.prepare).toHaveBeenCalledWith(expect.stringContaining('worker_name = ?'));
			expect(mockD1.prepare).toHaveBeenCalledWith(expect.stringContaining('endpoint = ?'));
			expect(mockStatement.bind).toHaveBeenCalledWith('error', 'api-worker', '/events', 50);
		});

		it('should handle empty result set gracefully', async () => {
			const mockLogs: any[] = [];
			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest({ level: 'debug' });
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');
			const result = await parseResponse(response);

			expect(result.status).toBe(200);
			expect(result.body.logs).toHaveLength(0);
			expect(result.body.count).toBe(0);
			expect(result.body.timestamp).toBeDefined();
		});

		it('should include all log fields in response', async () => {
			const mockLogs = [
				{
					log_id: 'log-1',
					correlation_id: 'corr-1',
					request_id: 'req-1',
					timestamp: '2025-11-11T10:00:00Z',
					log_level: 'error',
					message: 'Server error',
					method: 'POST',
					path: '/events',
					endpoint: '/events',
					query_params: 'debug=true',
					status_code: 500,
					status_class: '5xx',
					duration_ms: 123,
					cpu_ms: 45,
					db_query_ms: 67,
					queue_wait_ms: 11,
					error_code: 'SERVER_ERROR',
					error_message: 'Database connection failed',
					error_category: 'server',
					error_stack: 'Error: Connection timeout\n  at ...',
					worker_name: 'api-worker',
					debug_flag: 'processing_error',
					environment: 'production',
					version: '1.0.0',
					created_at: '2025-11-11T10:00:00Z',
				},
			];

			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest();
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');
			const result = await parseResponse(response);

			expect(result.status).toBe(200);
			expect(result.body.logs).toHaveLength(1);

			const log = result.body.logs[0];
			expect(log).toHaveProperty('log_id');
			expect(log).toHaveProperty('correlation_id');
			expect(log).toHaveProperty('request_id');
			expect(log).toHaveProperty('timestamp');
			expect(log).toHaveProperty('log_level');
			expect(log).toHaveProperty('message');
			expect(log).toHaveProperty('method');
			expect(log).toHaveProperty('path');
			expect(log).toHaveProperty('endpoint');
			expect(log).toHaveProperty('status_code');
			expect(log).toHaveProperty('duration_ms');
			expect(log).toHaveProperty('error_code');
			expect(log).toHaveProperty('error_message');
			expect(log).toHaveProperty('worker_name');
		});

		it('should query logs from last 1 hour only', async () => {
			const mockLogs: any[] = [];
			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest();
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');

			// Verify time filter is included in query
			expect(mockD1.prepare).toHaveBeenCalledWith(expect.stringContaining("timestamp > datetime('now', '-1 hour')"));
		});
	});

	describe('error handling', () => {
		it('should handle database errors gracefully', async () => {
			const mockStatement = {
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockRejectedValue(new Error('Database connection failed')),
			};
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest();
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');
			const result = await parseResponse(response);

			expect(result.status).toBe(500);
			expect(result.body.error).toBe('Failed to fetch logs');
			expect(result.body.message).toBe('Database connection failed');
			expect(result.headers['x-correlation-id']).toBe('test-correlation-id');
		});

		it('should ignore invalid log level values', async () => {
			const mockLogs: any[] = [];
			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest({ level: 'invalid' });
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');

			// Should not include invalid level in query
			expect(mockD1.prepare).not.toHaveBeenCalledWith(expect.stringContaining('log_level = ?'));
		});
	});

	describe('response format', () => {
		it('should return standard API response format', async () => {
			const mockLogs: any[] = [];
			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest();
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');
			const result = await parseResponse(response);

			expect(result.body).toHaveProperty('logs');
			expect(result.body).toHaveProperty('count');
			expect(result.body).toHaveProperty('timestamp');
			expect(Array.isArray(result.body.logs)).toBe(true);
			expect(typeof result.body.count).toBe('number');
			expect(typeof result.body.timestamp).toBe('string');
		});

		it('should include correlation ID in response headers', async () => {
			const mockLogs: any[] = [];
			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest();
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-123');
			const result = await parseResponse(response);

			expect(result.headers['x-correlation-id']).toBe('test-correlation-123');
		});

		it('should set correct content-type header', async () => {
			const mockLogs: any[] = [];
			const mockStatement = createMockPreparedStatement(mockLogs);
			mockD1.prepare.mockReturnValue(mockStatement);

			const request = createRequest();
			const response = await handleGetLogs(request, mockEnv, 'test-correlation-id');
			const result = await parseResponse(response);

			expect(result.headers['content-type']).toBe('application/json');
		});
	});
});
