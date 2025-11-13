/**
 * Unit tests for RateLimiter
 * Epic 8.4: Security & Validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
	beforeEach(() => {
		// Clear all rate limits before each test
		RateLimiter.resetAll();
	});

	describe('basic rate limiting', () => {
		it('should allow requests under the limit', () => {
			const result1 = RateLimiter.check('test-key', { limit: 3, windowMs: 1000 });
			const result2 = RateLimiter.check('test-key', { limit: 3, windowMs: 1000 });
			const result3 = RateLimiter.check('test-key', { limit: 3, windowMs: 1000 });

			expect(result1.allowed).toBe(true);
			expect(result2.allowed).toBe(true);
			expect(result3.allowed).toBe(true);
		});

		it('should block requests over the limit', () => {
			const config = { limit: 2, windowMs: 1000 };

			RateLimiter.check('test-key', config);
			RateLimiter.check('test-key', config);
			const result = RateLimiter.check('test-key', config);

			expect(result.allowed).toBe(false);
			expect(result.retryAfter).toBeDefined();
			expect(result.retryAfter).toBeGreaterThan(0);
		});

		it('should track remaining requests correctly', () => {
			const config = { limit: 5, windowMs: 1000 };

			const result1 = RateLimiter.check('test-key', config);
			expect(result1.remaining).toBe(4);

			const result2 = RateLimiter.check('test-key', config);
			expect(result2.remaining).toBe(3);

			const result3 = RateLimiter.check('test-key', config);
			expect(result3.remaining).toBe(2);
		});
	});

	describe('key isolation', () => {
		it('should track different keys separately', () => {
			const config = { limit: 2, windowMs: 1000 };

			RateLimiter.check('key1', config);
			RateLimiter.check('key1', config);
			const result1 = RateLimiter.check('key1', config);

			const result2 = RateLimiter.check('key2', config);

			expect(result1.allowed).toBe(false);
			expect(result2.allowed).toBe(true);
		});
	});

	describe('subscription rate limiting', () => {
		it('should allow up to 100 subscription requests', () => {
			const ip = '192.168.1.1';

			for (let i = 0; i < 100; i++) {
				const result = RateLimiter.checkSubscription(ip);
				expect(result.allowed).toBe(true);
			}

			const blockedResult = RateLimiter.checkSubscription(ip);
			expect(blockedResult.allowed).toBe(false);
		});

		it('should return correct limit and remaining for subscriptions', () => {
			const result = RateLimiter.checkSubscription('192.168.1.1');

			expect(result.limit).toBe(100);
			expect(result.remaining).toBe(99);
		});
	});

	describe('sample rate limiting', () => {
		it('should allow up to 60 sample requests', () => {
			const ip = '192.168.1.1';

			for (let i = 0; i < 60; i++) {
				const result = RateLimiter.checkSample(ip);
				expect(result.allowed).toBe(true);
			}

			const blockedResult = RateLimiter.checkSample(ip);
			expect(blockedResult.allowed).toBe(false);
		});

		it('should return correct limit and remaining for samples', () => {
			const result = RateLimiter.checkSample('192.168.1.1');

			expect(result.limit).toBe(60);
			expect(result.remaining).toBe(59);
		});
	});

	describe('reset functionality', () => {
		it('should reset specific key', () => {
			const config = { limit: 2, windowMs: 1000 };

			RateLimiter.check('test-key', config);
			RateLimiter.check('test-key', config);
			let result = RateLimiter.check('test-key', config);
			expect(result.allowed).toBe(false);

			RateLimiter.reset('test-key');

			result = RateLimiter.check('test-key', config);
			expect(result.allowed).toBe(true);
		});

		it('should reset all keys', () => {
			const config = { limit: 2, windowMs: 1000 };

			RateLimiter.check('key1', config);
			RateLimiter.check('key1', config);
			RateLimiter.check('key2', config);
			RateLimiter.check('key2', config);

			RateLimiter.resetAll();

			const result1 = RateLimiter.check('key1', config);
			const result2 = RateLimiter.check('key2', config);

			expect(result1.allowed).toBe(true);
			expect(result2.allowed).toBe(true);
		});
	});

	describe('getStatus', () => {
		it('should return status without incrementing counter', () => {
			const config = { limit: 5, windowMs: 1000 };

			RateLimiter.check('test-key', config);
			const status1 = RateLimiter.getStatus('test-key', config);
			const status2 = RateLimiter.getStatus('test-key', config);

			expect(status1.remaining).toBe(4);
			expect(status2.remaining).toBe(4);
		});

		it('should return correct status for blocked key', () => {
			const config = { limit: 2, windowMs: 1000 };

			RateLimiter.check('test-key', config);
			RateLimiter.check('test-key', config);

			const status = RateLimiter.getStatus('test-key', config);

			expect(status.allowed).toBe(false);
			expect(status.remaining).toBe(0);
		});

		it('should return default status for new key', () => {
			const config = { limit: 10, windowMs: 1000 };
			const status = RateLimiter.getStatus('new-key', config);

			expect(status.allowed).toBe(true);
			expect(status.remaining).toBe(10);
		});
	});

	describe('retry-after header', () => {
		it('should include retry-after when rate limited', () => {
			const config = { limit: 1, windowMs: 5000 };

			RateLimiter.check('test-key', config);
			const result = RateLimiter.check('test-key', config);

			expect(result.allowed).toBe(false);
			expect(result.retryAfter).toBeDefined();
			expect(result.retryAfter).toBeGreaterThan(0);
			expect(result.retryAfter).toBeLessThanOrEqual(5);
		});
	});

	describe('resetAt timestamp', () => {
		it('should return resetAt timestamp', () => {
			const config = { limit: 5, windowMs: 3600000 };
			const before = Date.now();
			const result = RateLimiter.check('test-key', config);
			const after = Date.now();

			expect(result.resetAt).toBeDefined();
			expect(result.resetAt).toBeGreaterThanOrEqual(before + config.windowMs);
			expect(result.resetAt).toBeLessThanOrEqual(after + config.windowMs);
		});
	});

	describe('cleanup', () => {
		it('should remove expired entries', async () => {
			const config = { limit: 2, windowMs: 10 }; // 10ms window

			RateLimiter.check('test-key', config);

			// Wait for window to expire
			await new Promise((resolve) => setTimeout(resolve, 20));

			RateLimiter.cleanup();

			// Should be able to make requests again
			const result = RateLimiter.check('test-key', config);
			expect(result.remaining).toBe(1); // First request after cleanup
		});
	});

	describe('correlation ID logging', () => {
		it('should accept correlation ID parameter', () => {
			const config = { limit: 5, windowMs: 1000 };

			// Should not throw when correlation ID is provided
			expect(() => {
				RateLimiter.check('test-key', config, 'corr-123');
			}).not.toThrow();
		});

		it('should work without correlation ID', () => {
			const config = { limit: 5, windowMs: 1000 };

			// Should not throw when correlation ID is omitted
			expect(() => {
				RateLimiter.check('test-key', config);
			}).not.toThrow();
		});
	});
});
