/**
 * Rate Limiting Service
 * Epic 8.4: Security & Validation
 *
 * Implements rate limiting for webhook subscriptions and sample endpoint
 * - Subscription rate: 100 requests per IP per hour
 * - Sample endpoint rate: 60 requests per IP per hour
 * - In-memory storage (resets on worker restart)
 * - Sliding window implementation
 */

import { logger } from './logger';

/**
 * Rate limiter configuration
 */
interface RateLimitConfig {
	limit: number; // Maximum requests allowed
	windowMs: number; // Time window in milliseconds
}

/**
 * Rate limit check result
 */
interface RateLimitResult {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAt: number; // Unix timestamp when limit resets
	retryAfter?: number; // Seconds until retry allowed (if rate limited)
}

/**
 * RateLimiter
 *
 * Sliding window rate limiting based on client IP address
 */
export class RateLimiter {
	// In-memory storage for rate limit tracking
	// Map<key, timestamp[]>
	private static store = new Map<string, number[]>();

	// Preset configurations
	static readonly SUBSCRIPTION_LIMIT: RateLimitConfig = {
		limit: 100,
		windowMs: 3600000, // 1 hour
	};

	static readonly SAMPLE_LIMIT: RateLimitConfig = {
		limit: 60,
		windowMs: 3600000, // 1 hour
	};

	/**
	 * Check rate limit for a given key
	 *
	 * @param key - Rate limit key (typically IP address)
	 * @param config - Rate limit configuration
	 * @param correlationId - Request correlation ID for logging
	 * @returns Rate limit check result
	 */
	static check(key: string, config: RateLimitConfig, correlationId?: string): RateLimitResult {
		const now = Date.now();
		const windowStart = now - config.windowMs;

		// Get or create timestamp array for this key
		let timestamps = this.store.get(key) || [];

		// Remove timestamps outside the current window
		timestamps = timestamps.filter((ts) => ts > windowStart);

		// Check if limit exceeded
		if (timestamps.length >= config.limit) {
			const oldestTimestamp = timestamps[0];
			const resetAt = oldestTimestamp + config.windowMs;
			const retryAfter = Math.ceil((resetAt - now) / 1000);

			logger.warn('Rate limit exceeded', {
				correlation_id: correlationId,
				key,
				limit: config.limit,
				window_ms: config.windowMs,
				retry_after_seconds: retryAfter,
			});

			return {
				allowed: false,
				limit: config.limit,
				remaining: 0,
				resetAt,
				retryAfter,
			};
		}

		// Add current timestamp
		timestamps.push(now);
		this.store.set(key, timestamps);

		// Calculate next reset time
		const resetAt = timestamps[0] + config.windowMs;

		logger.debug('Rate limit check passed', {
			correlation_id: correlationId,
			key,
			limit: config.limit,
			remaining: config.limit - timestamps.length,
		});

		return {
			allowed: true,
			limit: config.limit,
			remaining: config.limit - timestamps.length,
			resetAt,
		};
	}

	/**
	 * Check subscription rate limit (100 per hour per IP)
	 *
	 * @param ip - Client IP address
	 * @param correlationId - Request correlation ID
	 * @returns Rate limit check result
	 */
	static checkSubscription(ip: string, correlationId?: string): RateLimitResult {
		return this.check(`subscribe:${ip}`, this.SUBSCRIPTION_LIMIT, correlationId);
	}

	/**
	 * Check sample endpoint rate limit (60 per hour per IP)
	 *
	 * @param ip - Client IP address
	 * @param correlationId - Request correlation ID
	 * @returns Rate limit check result
	 */
	static checkSample(ip: string, correlationId?: string): RateLimitResult {
		return this.check(`sample:${ip}`, this.SAMPLE_LIMIT, correlationId);
	}

	/**
	 * Reset rate limit for a specific key
	 * Useful for testing or admin actions
	 *
	 * @param key - Rate limit key to reset
	 */
	static reset(key: string): void {
		this.store.delete(key);
		logger.info('Rate limit reset', { key });
	}

	/**
	 * Clear all rate limit data
	 * Useful for testing
	 */
	static resetAll(): void {
		this.store.clear();
		logger.info('All rate limits cleared');
	}

	/**
	 * Get current rate limit status for a key
	 *
	 * @param key - Rate limit key
	 * @param config - Rate limit configuration
	 * @returns Current status without incrementing counter
	 */
	static getStatus(key: string, config: RateLimitConfig): RateLimitResult {
		const now = Date.now();
		const windowStart = now - config.windowMs;

		// Get timestamp array for this key
		let timestamps = this.store.get(key) || [];

		// Remove timestamps outside the current window
		timestamps = timestamps.filter((ts) => ts > windowStart);

		// Update store with filtered timestamps
		if (timestamps.length > 0) {
			this.store.set(key, timestamps);
		} else {
			this.store.delete(key);
		}

		const resetAt = timestamps.length > 0 ? timestamps[0] + config.windowMs : now + config.windowMs;

		return {
			allowed: timestamps.length < config.limit,
			limit: config.limit,
			remaining: Math.max(0, config.limit - timestamps.length),
			resetAt,
		};
	}

	/**
	 * Periodic cleanup of expired entries
	 * Should be called periodically to prevent memory growth
	 */
	static cleanup(): void {
		const now = Date.now();
		let cleaned = 0;

		for (const [key, timestamps] of this.store.entries()) {
			// Get the maximum window size used
			const maxWindow = Math.max(this.SUBSCRIPTION_LIMIT.windowMs, this.SAMPLE_LIMIT.windowMs);

			// Filter out timestamps older than the maximum window
			const filtered = timestamps.filter((ts) => now - ts < maxWindow);

			if (filtered.length === 0) {
				this.store.delete(key);
				cleaned++;
			} else if (filtered.length < timestamps.length) {
				this.store.set(key, filtered);
			}
		}

		if (cleaned > 0) {
			logger.debug('Rate limiter cleanup completed', {
				entries_cleaned: cleaned,
				entries_remaining: this.store.size,
			});
		}
	}
}
