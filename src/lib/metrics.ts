/**
 * Metrics Manager
 *
 * Provides KV-based metrics tracking for event processing
 * - Aggregate counters (total, pending, delivered, failed)
 * - Queue and DLQ monitoring
 * - Timestamp tracking (last processed, last failure)
 * - Processing time recording
 * - Non-blocking failures (metrics errors don't fail workflow)
 *
 * Architecture:
 * - All metrics use 'metrics:' prefix for organization
 * - Counters stored as strings in KV
 * - Read-modify-write pattern (eventual consistency acceptable)
 * - Metadata tracked with each counter update
 */

import { logger } from './logger';

/**
 * Metrics interface for dashboard consumption
 * Returned by getAllMetrics() for GET /metrics endpoint
 */
export interface Metrics {
	total_events: number;
	pending: number;
	delivered: number;
	failed: number;
	queue_depth: number;
	dlq_count: number;
	last_processed_at: string | null;
	processing_rate: number; // events per minute estimate
}

/**
 * MetricsManager - KV-based metrics tracking
 *
 * Handles all metrics operations with graceful error handling
 * KV operations are non-blocking - failures logged but don't throw
 */
export class MetricsManager {
	constructor(private kv: KVNamespace) {}

	/**
	 * Increment a counter atomically (read-modify-write)
	 *
	 * Note: KV doesn't have true atomic increment, but acceptable for metrics
	 * Reads current value, increments, writes back with metadata
	 *
	 * @param key - Counter key to increment
	 * @param delta - Amount to increment (default: 1)
	 * @param metadata - Optional metadata to store with counter
	 * @returns New counter value
	 */
	async incrementCounter(key: string, delta: number = 1, metadata?: Record<string, any>): Promise<number> {
		try {
			const current = await this.kv.get(key, 'text');
			const currentValue = current ? parseInt(current, 10) : 0;
			const newValue = currentValue + delta;

			await this.kv.put(key, String(newValue), {
				metadata: {
					updated_at: new Date().toISOString(),
					...metadata,
				},
			});

			return newValue;
		} catch (error) {
			logger.error('Failed to increment counter', {
				key,
				delta,
				error: error instanceof Error ? error.message : 'Unknown',
			});
			throw error;
		}
	}

	/**
	 * Update metrics on event storage (called from workflow step 3)
	 *
	 * Increments:
	 * - metrics:events:total (all events processed)
	 * - metrics:events:pending (events with status=pending)
	 * Updates:
	 * - metrics:last_processed_at (ISO-8601 timestamp)
	 * - metrics:last_processing_time_ms (processing duration)
	 *
	 * Non-blocking: Catches errors and logs but doesn't throw
	 *
	 * @param eventId - Event identifier for logging
	 * @param status - Event status (pending, delivered, failed)
	 * @param processingTimeMs - Time taken to process event
	 */
	async recordEventStored(
		eventId: string,
		status: 'pending' | 'delivered' | 'failed',
		processingTimeMs: number
	): Promise<void> {
		try {
			// Increment total and status-specific counters in parallel
			await Promise.all([
				this.incrementCounter('metrics:events:total', 1, {
					event_id: eventId,
				}),
				this.incrementCounter(`metrics:events:${status}`, 1),
				this.updateLastProcessedAt(),
				this.recordProcessingTime(processingTimeMs),
			]);

			logger.info('Metrics recorded for event storage', {
				event_id: eventId,
				status,
				processing_time_ms: processingTimeMs,
			});
		} catch (error) {
			logger.error('Failed to record metrics', {
				event_id: eventId,
				error: error instanceof Error ? error.message : 'Unknown',
			});
			// Don't throw - metrics are secondary to core functionality
		}
	}

	/**
	 * Update metrics on status change (pending → delivered/failed)
	 *
	 * Called when event transitions between statuses
	 * Decrements old status counter, increments new status counter
	 *
	 * Non-blocking: Catches errors and logs but doesn't throw
	 *
	 * @param eventId - Event identifier for logging
	 * @param previousStatus - Status before transition
	 * @param newStatus - Status after transition
	 */
	async recordStatusChange(
		eventId: string,
		previousStatus: 'pending' | 'delivered' | 'failed',
		newStatus: 'pending' | 'delivered' | 'failed'
	): Promise<void> {
		try {
			// Decrement old status counter (prevent negative values)
			const oldCount = await this.kv.get(`metrics:events:${previousStatus}`, 'text');
			if (oldCount) {
				const currentValue = parseInt(oldCount, 10);
				await this.kv.put(`metrics:events:${previousStatus}`, String(Math.max(0, currentValue - 1)));
			}

			// Increment new status counter
			await this.incrementCounter(`metrics:events:${newStatus}`, 1);

			logger.info('Metrics recorded for status change', {
				event_id: eventId,
				from: previousStatus,
				to: newStatus,
			});
		} catch (error) {
			logger.error('Failed to record status change metrics', {
				event_id: eventId,
				error: error instanceof Error ? error.message : 'Unknown',
			});
			// Don't throw - metrics are secondary
		}
	}

	/**
	 * Record processing failure and store in DLQ for inspection
	 *
	 * Called when workflow fails or event routed to DLQ
	 * Increments failed counter and stores failure metadata
	 *
	 * Non-blocking: Catches errors and logs but doesn't throw
	 *
	 * @param eventId - Event identifier
	 * @param reason - Failure reason
	 * @param correlationId - Request correlation ID for tracing
	 */
	async recordFailure(eventId: string, reason: string, correlationId: string): Promise<void> {
		try {
			await Promise.all([
				this.incrementCounter('metrics:events:failed', 1),
				this.updateLastFailureAt(),
				this.kv.put(
					`dlq:${eventId}`,
					JSON.stringify({
						event_id: eventId,
						reason,
						correlation_id: correlationId,
						failed_at: new Date().toISOString(),
					})
				),
			]);

			logger.info('Failure recorded', {
				event_id: eventId,
				reason,
				correlation_id: correlationId,
			});
		} catch (error) {
			logger.error('Failed to record failure metrics', {
				event_id: eventId,
				error: error instanceof Error ? error.message : 'Unknown',
			});
			// Don't throw - metrics are secondary
		}
	}

	/**
	 * Update queue depth metric
	 *
	 * Called by queue consumer when batch received
	 * Stores current number of messages in queue
	 *
	 * @param depth - Current queue message count
	 */
	async updateQueueDepth(depth: number): Promise<void> {
		try {
			await this.kv.put('metrics:queue:depth', String(depth), {
				metadata: {
					updated_at: new Date().toISOString(),
				},
			});
		} catch (error) {
			logger.error('Failed to update queue depth', {
				error: error instanceof Error ? error.message : 'Unknown',
			});
			// Don't throw - metrics are secondary
		}
	}

	/**
	 * Update DLQ message count
	 *
	 * Manual in MVP, could be automated post-deployment
	 * Stores current number of messages in dead letter queue
	 *
	 * @param count - Current DLQ message count
	 */
	async updateDLQCount(count: number): Promise<void> {
		try {
			await this.kv.put('metrics:dlq:count', String(count), {
				metadata: {
					updated_at: new Date().toISOString(),
				},
			});
		} catch (error) {
			logger.error('Failed to update DLQ count', {
				error: error instanceof Error ? error.message : 'Unknown',
			});
			// Don't throw - metrics are secondary
		}
	}

	/**
	 * Get all metrics for dashboard
	 *
	 * Retrieves all metric counters from KV and formats for API response
	 * Used by GET /metrics endpoint
	 *
	 * @returns Complete metrics object with all counters
	 * @throws Error if KV retrieval fails
	 */
	async getAllMetrics(): Promise<Metrics> {
		try {
			const [total, pending, delivered, failed, queueDepth, dlqCount, lastProcessed] = await Promise.all([
				this.kv.get('metrics:events:total', 'text'),
				this.kv.get('metrics:events:pending', 'text'),
				this.kv.get('metrics:events:delivered', 'text'),
				this.kv.get('metrics:events:failed', 'text'),
				this.kv.get('metrics:queue:depth', 'text'),
				this.kv.get('metrics:dlq:count', 'text'),
				this.kv.get('metrics:last_processed_at', 'text'),
			]);

			return {
				total_events: total ? parseInt(total, 10) : 0,
				pending: pending ? parseInt(pending, 10) : 0,
				delivered: delivered ? parseInt(delivered, 10) : 0,
				failed: failed ? parseInt(failed, 10) : 0,
				queue_depth: queueDepth ? parseInt(queueDepth, 10) : 0,
				dlq_count: dlqCount ? parseInt(dlqCount, 10) : 0,
				last_processed_at: lastProcessed || null,
				processing_rate: this.calculateProcessingRate(total ? parseInt(total, 10) : 0, lastProcessed),
			};
		} catch (error) {
			logger.error('Failed to retrieve metrics', {
				error: error instanceof Error ? error.message : 'Unknown',
			});
			throw error;
		}
	}

	/**
	 * Reset metrics to zero (dev/testing only)
	 *
	 * Resets all counter metrics to 0
	 * Useful for development and testing
	 *
	 * @param correlationId - Correlation ID for logging
	 */
	async resetMetrics(correlationId: string): Promise<void> {
		const keys = [
			'metrics:events:total',
			'metrics:events:pending',
			'metrics:events:delivered',
			'metrics:events:failed',
			'metrics:queue:depth',
			'metrics:dlq:count',
		];

		try {
			await Promise.all(keys.map((key) => this.kv.put(key, '0')));
			logger.info('Metrics reset', { correlation_id: correlationId });
		} catch (error) {
			logger.error('Failed to reset metrics', {
				error: error instanceof Error ? error.message : 'Unknown',
			});
		}
	}

	/**
	 * Internal: Update last processed timestamp
	 * @private
	 */
	private async updateLastProcessedAt(): Promise<void> {
		await this.kv.put('metrics:last_processed_at', new Date().toISOString());
	}

	/**
	 * Internal: Update last failure timestamp
	 * @private
	 */
	private async updateLastFailureAt(): Promise<void> {
		await this.kv.put('metrics:last_failure_at', new Date().toISOString());
	}

	/**
	 * Internal: Record processing time for latency calculation
	 * @private
	 */
	private async recordProcessingTime(ms: number): Promise<void> {
		// Store last processing time (could be enhanced with percentile calculation)
		await this.kv.put('metrics:last_processing_time_ms', String(ms));
	}

	/**
	 * Internal: Calculate events per minute from total and timestamp
	 * @private
	 */
	private calculateProcessingRate(totalEvents: number, lastProcessedAt: string | null): number {
		if (!lastProcessedAt || totalEvents === 0) return 0;

		const lastProcessed = new Date(lastProcessedAt).getTime();
		const now = Date.now();
		const elapsedMinutes = (now - lastProcessed) / (1000 * 60);

		if (elapsedMinutes === 0) return 0;

		return Math.round(totalEvents / elapsedMinutes);
	}
}
