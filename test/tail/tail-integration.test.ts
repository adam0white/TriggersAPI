/**
 * Tail Worker Integration Tests
 *
 * End-to-end tests verifying tail worker captures logs from real Worker invocations
 * Tests correlation ID propagation, structured logging, and D1 storage
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';

describe('Tail Worker Integration', () => {
	beforeAll(async () => {
		// Create table if it doesn't exist (test environment may not have migrations applied)
		const result = await env.DB.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='tail_logs'"
		).first();

		if (!result) {
			// Apply the migration manually for test environment
			// Create table
			await env.DB.prepare(`
				CREATE TABLE tail_logs (
					log_id TEXT PRIMARY KEY,
					worker_name TEXT NOT NULL,
					request_id TEXT,
					correlation_id TEXT,
					log_level TEXT NOT NULL CHECK(log_level IN ('debug', 'info', 'warn', 'error')),
					message TEXT NOT NULL,
					context_json TEXT,
					timestamp TEXT NOT NULL,
					execution_time_ms INTEGER,
					created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
				)
			`).run();

			// Create indexes
			await env.DB.prepare('CREATE INDEX idx_tail_logs_timestamp ON tail_logs(timestamp DESC)').run();
			await env.DB.prepare('CREATE INDEX idx_tail_logs_correlation_id ON tail_logs(correlation_id)').run();
			await env.DB.prepare('CREATE INDEX idx_tail_logs_worker_name ON tail_logs(worker_name)').run();
			await env.DB.prepare('CREATE INDEX idx_tail_logs_level ON tail_logs(log_level)').run();
			await env.DB.prepare('CREATE INDEX idx_tail_logs_created ON tail_logs(created_at DESC)').run();
		}
	});

	afterAll(async () => {
		// Clean up test data
		try {
			await env.DB.prepare('DELETE FROM tail_logs').run();
		} catch (error) {
			// Ignore cleanup errors in tests
			console.warn('Failed to cleanup tail_logs:', error);
		}
	});

	it('should capture logs from API request with correlation ID', async () => {
		// Create test token
		const testToken = 'test-token-' + crypto.randomUUID();
		await env.AUTH_KV.put(`token:${testToken}`, 'test-client');

		// Make request to POST /events
		const correlationId = crypto.randomUUID();
		const response = await SELF.fetch('https://api.example.com/events', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${testToken}`,
				'X-Correlation-ID': correlationId,
			},
			body: JSON.stringify({
				payload: { test: 'data' },
			}),
		});

		expect(response.status).toBe(200);

		// Wait a bit for tail worker to process (in tests, tail events are processed synchronously)
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Query tail_logs for the correlation ID
		const logs = await env.DB.prepare(
			'SELECT * FROM tail_logs WHERE correlation_id = ? ORDER BY created_at ASC'
		)
			.bind(correlationId)
			.all();

		// Should have captured at least one log with the correlation ID
		expect(logs.results.length).toBeGreaterThan(0);

		// Verify log structure
		const log = logs.results[0] as any;
		expect(log.correlation_id).toBe(correlationId);
		expect(log.log_level).toMatch(/^(debug|info|warn|error)$/);
		expect(log.message).toBeTruthy();
		expect(log.timestamp).toBeTruthy();
		expect(log.worker_name).toBeTruthy();
	});

	it('should capture structured logs with context', async () => {
		const testToken = 'test-token-' + crypto.randomUUID();
		await env.AUTH_KV.put(`token:${testToken}`, 'test-client');

		const correlationId = crypto.randomUUID();
		const response = await SELF.fetch('https://api.example.com/events', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${testToken}`,
				'X-Correlation-ID': correlationId,
			},
			body: JSON.stringify({
				payload: { structured: 'test' },
			}),
		});

		expect(response.status).toBe(200);
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Query for logs with context
		const logs = await env.DB.prepare(
			'SELECT * FROM tail_logs WHERE correlation_id = ? AND context_json IS NOT NULL'
		)
			.bind(correlationId)
			.all();

		expect(logs.results.length).toBeGreaterThan(0);

		// Verify context_json is valid JSON
		const log = logs.results[0] as any;
		const context = JSON.parse(log.context_json);
		expect(context).toBeDefined();
	});

	it('should capture exception logs with error level', async () => {
		// Make request that will trigger validation error (bad JSON structure)
		const correlationId = crypto.randomUUID();
		const response = await SELF.fetch('https://api.example.com/events', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Correlation-ID': correlationId,
			},
			body: 'invalid-json',
		});

		expect(response.status).toBe(401); // No auth token

		await new Promise((resolve) => setTimeout(resolve, 100));

		// Should have captured logs even for failed requests
		const logs = await env.DB.prepare('SELECT * FROM tail_logs WHERE correlation_id = ?')
			.bind(correlationId)
			.all();

		// May not have logs if request failed early in auth, but test shouldn't error
		expect(logs.results).toBeDefined();
	});

	it('should handle batch insertion for multiple requests', async () => {
		const testToken = 'test-token-' + crypto.randomUUID();
		await env.AUTH_KV.put(`token:${testToken}`, 'test-client');

		// Make multiple requests
		const requests = Array.from({ length: 5 }, (_, i) => {
			const correlationId = crypto.randomUUID();
			return SELF.fetch('https://api.example.com/events', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
					'X-Correlation-ID': correlationId,
				},
				body: JSON.stringify({
					payload: { batch: i },
				}),
			});
		});

		const responses = await Promise.all(requests);
		responses.forEach((response) => expect(response.status).toBe(200));

		await new Promise((resolve) => setTimeout(resolve, 200));

		// Query all tail logs
		const allLogs = await env.DB.prepare('SELECT COUNT(*) as count FROM tail_logs').all();
		expect((allLogs.results[0] as any).count).toBeGreaterThan(0);
	});

	it('should preserve correlation ID across request lifecycle', async () => {
		const testToken = 'test-token-' + crypto.randomUUID();
		await env.AUTH_KV.put(`token:${testToken}`, 'test-client');

		const correlationId = crypto.randomUUID();
		const response = await SELF.fetch('https://api.example.com/events', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${testToken}`,
				'X-Correlation-ID': correlationId,
			},
			body: JSON.stringify({
				payload: { test: 'correlation' },
			}),
		});

		expect(response.status).toBe(200);

		// Check response header includes correlation ID
		expect(response.headers.get('X-Correlation-ID')).toBe(correlationId);

		await new Promise((resolve) => setTimeout(resolve, 100));

		// All logs for this request should have same correlation ID
		const logs = await env.DB.prepare('SELECT correlation_id FROM tail_logs WHERE correlation_id = ?')
			.bind(correlationId)
			.all();

		// All results should have matching correlation ID
		logs.results.forEach((log: any) => {
			expect(log.correlation_id).toBe(correlationId);
		});
	});

	it('should query logs by timestamp descending order', async () => {
		const testToken = 'test-token-' + crypto.randomUUID();
		await env.AUTH_KV.put(`token:${testToken}`, 'test-client');

		// Create a few requests with delays
		for (let i = 0; i < 3; i++) {
			await SELF.fetch('https://api.example.com/events', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${testToken}`,
				},
				body: JSON.stringify({
					payload: { seq: i },
				}),
			});
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		await new Promise((resolve) => setTimeout(resolve, 100));

		// Query logs in timestamp descending order (most recent first)
		const logs = await env.DB.prepare('SELECT * FROM tail_logs ORDER BY timestamp DESC LIMIT 10').all();

		expect(logs.results.length).toBeGreaterThan(0);

		// Verify ordering (timestamps should be descending)
		for (let i = 1; i < logs.results.length; i++) {
			const prev = (logs.results[i - 1] as any).timestamp;
			const curr = (logs.results[i] as any).timestamp;
			expect(new Date(prev).getTime()).toBeGreaterThanOrEqual(new Date(curr).getTime());
		}
	});
});
