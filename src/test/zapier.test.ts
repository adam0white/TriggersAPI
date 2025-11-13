/**
 * Zapier Webhook Subscription Endpoints - Unit Tests
 * Epic 8.2: Tests for webhook subscribe, test, and unsubscribe endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleZapierSubscribe, handleZapierTest, handleZapierUnsubscribe } from '../routes/zapier';
import type { ZapierSubscribeResponse, ZapierTestResponse, ZapierUnsubscribeResponse } from '../types/api';

// Mock environment for testing
function createMockEnv(): Env {
	const mockDB = {
		prepare: vi.fn((query: string) => {
			return {
				bind: vi.fn((...params: any[]) => {
					return {
						first: vi.fn().mockResolvedValue(null),
						run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
						all: vi.fn().mockResolvedValue({ results: [] }),
					};
				}),
			};
		}),
	};

	return {
		DB: mockDB as any,
	} as Env;
}

describe('Zapier Webhook Endpoints', () => {
	let env: Env;

	beforeEach(() => {
		env = createMockEnv();
	});

	describe('POST /zapier/hook - Subscribe', () => {
		it('should create a new webhook subscription for valid Zapier URL', async () => {
			const validUrl = 'https://hooks.zapier.com/hooks/catch/123456/abcdef/';

			const request = new Request('http://localhost/zapier/hook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: validUrl }),
			});

			const response = await handleZapierSubscribe(request, env);
			expect(response.status).toBe(201);

			const data = (await response.json()) as ZapierSubscribeResponse;
			expect(data.status).toBe('success');
			expect(data.url).toBe(validUrl);
			expect(data.id).toMatch(/^webhook_/);
			expect(data.message).toBe('Webhook subscription created');
		});

		it('should reject non-HTTPS URLs', async () => {
			const invalidUrl = 'http://hooks.zapier.com/hooks/catch/123456/abcdef/';

			const request = new Request('http://localhost/zapier/hook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: invalidUrl }),
			});

			const response = await handleZapierSubscribe(request, env);
			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data.status).toBe('error');
			expect(data.message).toContain('Must be HTTPS');
		});

		it('should reject non-Zapier domains', async () => {
			const invalidUrl = 'https://evil.com/hooks/catch/123456/abcdef/';

			const request = new Request('http://localhost/zapier/hook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: invalidUrl }),
			});

			const response = await handleZapierSubscribe(request, env);
			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data.status).toBe('error');
			expect(data.message).toContain('hooks.zapier.com');
		});

		it('should reject URLs without /hooks path', async () => {
			const invalidUrl = 'https://hooks.zapier.com/invalid/path/';

			const request = new Request('http://localhost/zapier/hook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: invalidUrl }),
			});

			const response = await handleZapierSubscribe(request, env);
			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data.status).toBe('error');
			expect(data.message).toContain('hooks URL');
		});

		it('should reject missing url field', async () => {
			const request = new Request('http://localhost/zapier/hook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});

			const response = await handleZapierSubscribe(request, env);
			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data.status).toBe('error');
			expect(data.message).toBe('Missing url field');
		});

		it('should reject invalid JSON', async () => {
			const request = new Request('http://localhost/zapier/hook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'invalid json',
			});

			const response = await handleZapierSubscribe(request, env);
			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data.status).toBe('error');
			expect(data.message).toContain('Invalid JSON');
		});

		it('should return 409 for duplicate webhook subscriptions', async () => {
			const validUrl = 'https://hooks.zapier.com/hooks/catch/123456/abcdef/';

			// Mock DB to return existing webhook
			const mockEnv = createMockEnv();
			mockEnv.DB.prepare = vi.fn((query: string) => {
				return {
					bind: vi.fn(() => {
						return {
							first: vi.fn().mockResolvedValue({ id: 'webhook_existing_123' }),
						};
					}),
				};
			}) as any;

			const request = new Request('http://localhost/zapier/hook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: validUrl }),
			});

			const response = await handleZapierSubscribe(request, mockEnv);
			expect(response.status).toBe(409);

			const data = await response.json();
			expect(data.status).toBe('error');
			expect(data.message).toBe('Webhook already subscribed');
		});
	});

	describe('GET /zapier/hook - Test', () => {
		it('should return sample event data', async () => {
			const request = new Request('http://localhost/zapier/hook', {
				method: 'GET',
			});

			const response = await handleZapierTest(request, env);
			expect(response.status).toBe(200);

			const data = (await response.json()) as ZapierTestResponse;
			expect(data.event_id).toMatch(/^evt_test_/);
			expect(data.event_type).toBe('test_event');
			expect(data.timestamp).toBeDefined();
			expect(data.payload).toBeDefined();
			expect(data.metadata).toBeDefined();
			expect(data.created_at).toBeDefined();
		});

		it('should include realistic sample payload', async () => {
			const request = new Request('http://localhost/zapier/hook', {
				method: 'GET',
			});

			const response = await handleZapierTest(request, env);
			const data = (await response.json()) as ZapierTestResponse;

			expect(data.payload).toHaveProperty('message');
			expect(data.payload).toHaveProperty('source', 'zapier_test');
			expect(data.payload).toHaveProperty('test', true);
			expect(data.payload).toHaveProperty('user_id');
			expect(data.payload).toHaveProperty('email');
		});

		it('should include metadata with correlation_id', async () => {
			const request = new Request('http://localhost/zapier/hook', {
				method: 'GET',
			});

			const response = await handleZapierTest(request, env);
			const data = (await response.json()) as ZapierTestResponse;

			expect(data.metadata).toHaveProperty('correlation_id');
			expect(data.metadata.correlation_id).toMatch(/^corr_test_/);
			expect(data.metadata).toHaveProperty('source_ip');
			expect(data.metadata).toHaveProperty('user_agent');
		});
	});

	describe('DELETE /zapier/hook - Unsubscribe', () => {
		it('should delete webhook subscription', async () => {
			const validUrl = 'https://hooks.zapier.com/hooks/catch/123456/abcdef/';

			const request = new Request('http://localhost/zapier/hook', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: validUrl }),
			});

			const response = await handleZapierUnsubscribe(request, env);
			expect(response.status).toBe(200);

			const data = (await response.json()) as ZapierUnsubscribeResponse;
			expect(data.status).toBe('success');
			expect(data.message).toBe('Webhook subscription removed');
		});

		it('should return 404 if webhook not found', async () => {
			const validUrl = 'https://hooks.zapier.com/hooks/catch/123456/abcdef/';

			// Mock DB to return no changes (webhook not found)
			const mockEnv = createMockEnv();
			mockEnv.DB.prepare = vi.fn((query: string) => {
				return {
					bind: vi.fn(() => {
						return {
							run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 0 } }),
						};
					}),
				};
			}) as any;

			const request = new Request('http://localhost/zapier/hook', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: validUrl }),
			});

			const response = await handleZapierUnsubscribe(request, mockEnv);
			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data.status).toBe('error');
			expect(data.message).toBe('Webhook not found');
		});

		it('should reject missing url field', async () => {
			const request = new Request('http://localhost/zapier/hook', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});

			const response = await handleZapierUnsubscribe(request, env);
			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data.status).toBe('error');
			expect(data.message).toBe('Missing url field');
		});

		it('should reject invalid JSON', async () => {
			const request = new Request('http://localhost/zapier/hook', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: 'invalid json',
			});

			const response = await handleZapierUnsubscribe(request, env);
			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data.status).toBe('error');
			expect(data.message).toContain('Invalid JSON');
		});
	});

	describe('CORS and Headers', () => {
		it('should include correlation-id in response headers', async () => {
			const request = new Request('http://localhost/zapier/hook', {
				method: 'GET',
			});

			const response = await handleZapierTest(request, env);
			expect(response.headers.get('x-correlation-id')).toBeTruthy();
		});

		it('should return application/json content-type', async () => {
			const request = new Request('http://localhost/zapier/hook', {
				method: 'GET',
			});

			const response = await handleZapierTest(request, env);
			expect(response.headers.get('content-type')).toBe('application/json');
		});
	});
});
