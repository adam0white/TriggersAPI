/**
 * MetricsCalculator - Comprehensive metrics calculation pipeline
 * Story 4.3: Metrics Calculation
 *
 * Computes latency percentiles, error rates, throughput, queue depth,
 * and other system metrics from stored logs and system state.
 * Metrics are stored in KV for fast dashboard access and in D1 for historical analysis.
 */

import type {
	LatencyMetrics,
	ErrorMetrics,
	SuccessMetrics,
	QueueMetrics,
	ThroughputMetrics,
	EventLifecycleMetrics,
	CPUMetrics,
	PayloadMetrics,
	DatabaseMetrics,
	MetricHistoryRecord,
} from '../types/metrics';
import { logger } from './logger';

/**
 * MetricsCalculator class
 * Calculates and stores various system metrics from log data
 */
export class MetricsCalculator {
	constructor(
		private db: D1Database,
		private kv: KVNamespace,
		private loggerInstance = logger
	) {}

	/**
	 * Calculate latency percentiles (p50, p95, p99) for each endpoint
	 * Uses last 1000 requests per endpoint for calculation
	 */
	async calculateLatencyPercentiles(): Promise<void> {
		try {
			const endpoints = ['/events', '/inbox', '/inbox/:id/ack', '/inbox/:id/retry'];

			for (const endpoint of endpoints) {
				// Get last 1000 requests for this endpoint (exclude 5xx errors)
				const result = await this.db
					.prepare(
						`
          SELECT duration_ms FROM log_entries
          WHERE endpoint = ? AND status_code < 500 AND duration_ms > 0
          ORDER BY timestamp DESC
          LIMIT 1000
        `
					)
					.bind(endpoint)
					.all();

				if (!result.results || result.results.length === 0) {
					this.loggerInstance.debug('No latency data for endpoint', { endpoint });
					continue;
				}

				const latencies = (result.results as any[])
					.map((r) => r.duration_ms)
					.filter((l) => l > 0 && l < 60000) // Filter outliers > 60s
					.sort((a, b) => a - b);

				if (latencies.length === 0) continue;

				const metrics: LatencyMetrics = {
					endpoint,
					p50: this.percentile(latencies, 50),
					p95: this.percentile(latencies, 95),
					p99: this.percentile(latencies, 99),
					max: Math.max(...latencies),
					avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
					count: latencies.length,
					timestamp: new Date().toISOString(),
				};

				// Validate percentile order
				if (!this.validatePercentileOrder(metrics)) {
					this.loggerInstance.warn('Invalid percentile order detected', { endpoint, metrics });
					continue;
				}

				// Store in KV
				await this.kv.put(`metrics:latency:${endpoint}`, JSON.stringify(metrics), {
					expirationTtl: 3600, // 1 hour TTL
				});

				// Store in history
				await this.storeMetricHistory('latency_p50', endpoint, metrics.p50, 'ms', metrics.count);
				await this.storeMetricHistory('latency_p95', endpoint, metrics.p95, 'ms', metrics.count);
				await this.storeMetricHistory('latency_p99', endpoint, metrics.p99, 'ms', metrics.count);

				this.loggerInstance.info('Latency percentiles calculated', {
					endpoint,
					p50: metrics.p50,
					p95: metrics.p95,
					p99: metrics.p99,
					count: metrics.count,
				});
			}
		} catch (error) {
			this.loggerInstance.error('Failed to calculate latency metrics', { error: String(error) });
		}
	}

	/**
	 * Calculate error rate from last 5 minutes of logs
	 * Groups errors by type and status class (4xx vs 5xx)
	 */
	async calculateErrorRate(): Promise<void> {
		try {
			// Get errors from last 5 minutes
			const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

			const result = await this.db
				.prepare(
					`
        SELECT
          COUNT(*) as total_count,
          status_code,
          error_category
        FROM log_entries
        WHERE timestamp > ?
        GROUP BY status_code, error_category
      `
				)
				.bind(fiveMinutesAgo)
				.all();

			if (!result.results || result.results.length === 0) {
				this.loggerInstance.debug('No log data for error rate calculation');
				return;
			}

			const rows = result.results as any[];
			let totalRequests = 0;
			let totalErrors = 0;
			let clientErrors = 0;
			let serverErrors = 0;
			const errorsByType: Record<string, number> = {};

			for (const row of rows) {
				const count = row.total_count || 0;
				const statusCode = row.status_code;
				const errorCategory = row.error_category;

				totalRequests += count;

				if (statusCode >= 400) {
					totalErrors += count;

					if (statusCode >= 400 && statusCode < 500) {
						clientErrors += count;
					} else if (statusCode >= 500) {
						serverErrors += count;
					}

					if (errorCategory) {
						errorsByType[errorCategory] = (errorsByType[errorCategory] || 0) + count;
					}
				}
			}

			const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

			const metrics: ErrorMetrics = {
				total_errors: totalErrors,
				error_rate: Math.round(errorRate * 10) / 10, // 1 decimal place
				total_requests: totalRequests,
				by_type: errorsByType,
				by_status: {
					'4xx': clientErrors,
					'5xx': serverErrors,
				},
				timestamp: new Date().toISOString(),
			};

			await this.kv.put('metrics:errors:rate', JSON.stringify(metrics), {
				expirationTtl: 600, // 10 minute TTL
			});

			// Store in history
			await this.storeMetricHistory('error_rate', null, metrics.error_rate, 'percent', totalRequests);

			this.loggerInstance.info('Error rate calculated', {
				rate: metrics.error_rate,
				total_errors: totalErrors,
				total_requests: totalRequests,
			});
		} catch (error) {
			this.loggerInstance.error('Failed to calculate error metrics', { error: String(error) });
		}
	}

	/**
	 * Calculate success rate (2xx responses) from last 5 minutes
	 */
	async calculateSuccessRate(): Promise<void> {
		try {
			const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

			const result = await this.db
				.prepare(
					`
        SELECT
          COUNT(*) as total_count,
          SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as success_count
        FROM log_entries
        WHERE timestamp > ?
      `
				)
				.bind(fiveMinutesAgo)
				.first();

			if (!result) {
				this.loggerInstance.debug('No data for success rate calculation');
				return;
			}

			const totalRequests = (result as any).total_count || 0;
			const successCount = (result as any).success_count || 0;
			const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;

			const metrics: SuccessMetrics = {
				success_rate: Math.round(successRate * 10) / 10,
				successful_requests: successCount,
				total_requests: totalRequests,
				timestamp: new Date().toISOString(),
			};

			await this.kv.put('metrics:success:rate', JSON.stringify(metrics), {
				expirationTtl: 600, // 10 minute TTL
			});

			// Store in history
			await this.storeMetricHistory('success_rate', null, metrics.success_rate, 'percent', totalRequests);

			this.loggerInstance.info('Success rate calculated', {
				rate: metrics.success_rate,
				successful: successCount,
				total: totalRequests,
			});
		} catch (error) {
			this.loggerInstance.error('Failed to calculate success rate', { error: String(error) });
		}
	}

	/**
	 * Calculate throughput metrics (requests/second, events/second)
	 * Uses last 1 minute window
	 */
	async calculateThroughput(): Promise<void> {
		try {
			// Get throughput from last 1 minute
			const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

			const result = await this.db
				.prepare(
					`
        SELECT
          COUNT(*) as request_count,
          endpoint
        FROM log_entries
        WHERE timestamp > ?
        GROUP BY endpoint
      `
				)
				.bind(oneMinuteAgo)
				.all();

			const rows = result.results as any[];
			let totalRequests = 0;

			for (const row of rows) {
				totalRequests += row.request_count;
			}

			const rps = totalRequests / 60; // requests per second
			const eps = rps; // events per second (same for API requests)

			const metrics: ThroughputMetrics = {
				rps: Math.round(rps * 100) / 100,
				eps: Math.round(eps * 100) / 100,
				total_requests: totalRequests,
				timestamp: new Date().toISOString(),
			};

			await this.kv.put('metrics:throughput', JSON.stringify(metrics), {
				expirationTtl: 600, // 10 minute TTL
			});

			// Store in history
			await this.storeMetricHistory('throughput_rps', null, metrics.rps, 'rps', totalRequests);

			this.loggerInstance.info('Throughput calculated', { rps: metrics.rps, total: totalRequests });
		} catch (error) {
			this.loggerInstance.error('Failed to calculate throughput metrics', { error: String(error) });
		}
	}

	/**
	 * Calculate queue depth and DLQ metrics from D1 events table
	 */
	async calculateQueueMetrics(): Promise<void> {
		try {
			// Get pending event count from D1
			const pendingResult = await this.db
				.prepare(
					`
        SELECT COUNT(*) as pending_count FROM events WHERE status = 'pending'
      `
				)
				.first();

			const queueDepth = (pendingResult as any)?.pending_count || 0;

			// Get failed count for DLQ
			const failedResult = await this.db
				.prepare(
					`
        SELECT COUNT(*) as failed_count FROM events WHERE status = 'failed'
      `
				)
				.first();

			const failedCount = (failedResult as any)?.failed_count || 0;

			const metrics: QueueMetrics = {
				queue_depth: queueDepth,
				dlq_count: failedCount,
				timestamp: new Date().toISOString(),
			};

			await this.kv.put('metrics:queue', JSON.stringify(metrics), {
				expirationTtl: 300, // 5 minute TTL
			});

			// Store in history
			await this.storeMetricHistory('queue_depth', null, queueDepth, 'count', 1);
			await this.storeMetricHistory('dlq_count', null, failedCount, 'count', 1);

			this.loggerInstance.info('Queue metrics calculated', {
				queue_depth: queueDepth,
				dlq_count: failedCount,
			});
		} catch (error) {
			this.loggerInstance.error('Failed to calculate queue metrics', { error: String(error) });
		}
	}

	/**
	 * Calculate event lifecycle metrics (pending, delivered, failed counts)
	 */
	async calculateEventLifecycleMetrics(): Promise<void> {
		try {
			const result = await this.db
				.prepare(
					`
        SELECT
          COUNT(*) as total_events,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_events,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_events,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_events,
          AVG(CASE WHEN status = 'delivered' THEN retry_count ELSE NULL END) as avg_retries
        FROM events
      `
				)
				.first();

			if (!result) {
				this.loggerInstance.debug('No event lifecycle data');
				return;
			}

			const data = result as any;
			const totalEvents = data.total_events || 0;
			const deliveredEvents = data.delivered_events || 0;
			const deliveryRate = totalEvents > 0 ? (deliveredEvents / totalEvents) * 100 : 0;

			const metrics: EventLifecycleMetrics = {
				total_events: totalEvents,
				pending_events: data.pending_events || 0,
				delivered_events: deliveredEvents,
				failed_events: data.failed_events || 0,
				delivery_rate: Math.round(deliveryRate * 10) / 10,
				avg_retries: Math.round((data.avg_retries || 0) * 10) / 10,
				timestamp: new Date().toISOString(),
			};

			await this.kv.put('metrics:events:lifecycle', JSON.stringify(metrics), {
				expirationTtl: 600, // 10 minute TTL
			});

			// Store in history
			await this.storeMetricHistory('events_total', null, totalEvents, 'count', 1);
			await this.storeMetricHistory('events_pending', null, metrics.pending_events, 'count', 1);
			await this.storeMetricHistory('events_delivered', null, deliveredEvents, 'count', 1);
			await this.storeMetricHistory('events_failed', null, metrics.failed_events, 'count', 1);

			this.loggerInstance.info('Event lifecycle metrics calculated', {
				total: totalEvents,
				pending: metrics.pending_events,
				delivered: deliveredEvents,
				failed: metrics.failed_events,
			});
		} catch (error) {
			this.loggerInstance.error('Failed to calculate event lifecycle metrics', { error: String(error) });
		}
	}

	/**
	 * Calculate CPU execution time percentiles from log entries
	 */
	async calculateCPUMetrics(): Promise<void> {
		try {
			const result = await this.db
				.prepare(
					`
        SELECT cpu_ms FROM log_entries
        WHERE cpu_ms > 0 AND cpu_ms < 60000
        ORDER BY timestamp DESC
        LIMIT 1000
      `
				)
				.all();

			if (!result.results || result.results.length === 0) {
				this.loggerInstance.debug('No CPU metrics data');
				return;
			}

			const cpuTimes = (result.results as any[]).map((r) => r.cpu_ms).sort((a, b) => a - b);

			const metrics: CPUMetrics = {
				p50: this.percentile(cpuTimes, 50),
				p95: this.percentile(cpuTimes, 95),
				p99: this.percentile(cpuTimes, 99),
				max: Math.max(...cpuTimes),
				avg: cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length,
				timestamp: new Date().toISOString(),
			};

			await this.kv.put('metrics:cpu', JSON.stringify(metrics), {
				expirationTtl: 3600, // 1 hour TTL
			});

			// Store in history
			await this.storeMetricHistory('cpu_p50', null, metrics.p50, 'ms', cpuTimes.length);
			await this.storeMetricHistory('cpu_p95', null, metrics.p95, 'ms', cpuTimes.length);
			await this.storeMetricHistory('cpu_p99', null, metrics.p99, 'ms', cpuTimes.length);

			this.loggerInstance.info('CPU metrics calculated', {
				p50: metrics.p50,
				p95: metrics.p95,
				p99: metrics.p99,
			});
		} catch (error) {
			this.loggerInstance.error('Failed to calculate CPU metrics', { error: String(error) });
		}
	}

	/**
	 * Calculate payload size metrics (request and response sizes)
	 */
	async calculatePayloadMetrics(): Promise<void> {
		try {
			const result = await this.db
				.prepare(
					`
        SELECT
          AVG(request_body_size) as avg_request_size,
          AVG(response_body_size) as avg_response_size,
          MAX(request_body_size) as max_request_size,
          MAX(response_body_size) as max_response_size
        FROM log_entries
        WHERE timestamp > ?
      `
				)
				.bind(new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
				.first();

			if (!result) {
				this.loggerInstance.debug('No payload metrics data');
				return;
			}

			const data = result as any;
			const metrics: PayloadMetrics = {
				avg_request_size: Math.round(data.avg_request_size || 0),
				avg_response_size: Math.round(data.avg_response_size || 0),
				max_request_size: data.max_request_size || 0,
				max_response_size: data.max_response_size || 0,
				timestamp: new Date().toISOString(),
			};

			await this.kv.put('metrics:payload', JSON.stringify(metrics), {
				expirationTtl: 3600, // 1 hour TTL
			});

			// Store in history
			await this.storeMetricHistory('payload_avg_request', null, metrics.avg_request_size, 'bytes', 1);
			await this.storeMetricHistory('payload_avg_response', null, metrics.avg_response_size, 'bytes', 1);

			this.loggerInstance.info('Payload metrics calculated', metrics);
		} catch (error) {
			this.loggerInstance.error('Failed to calculate payload metrics', { error: String(error) });
		}
	}

	/**
	 * Calculate database query performance metrics
	 */
	async calculateDatabaseMetrics(): Promise<void> {
		try {
			const result = await this.db
				.prepare(
					`
        SELECT
          AVG(db_query_ms) as avg_query_time,
          COUNT(CASE WHEN db_query_ms > 100 THEN 1 END) as slow_query_count,
          COUNT(*) as total_queries
        FROM log_entries
        WHERE db_query_ms > 0 AND timestamp > ?
      `
				)
				.bind(new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
				.first();

			if (!result) {
				this.loggerInstance.debug('No database metrics data');
				return;
			}

			const data = result as any;
			const metrics: DatabaseMetrics = {
				avg_query_time: Math.round((data.avg_query_time || 0) * 10) / 10,
				slow_query_count: data.slow_query_count || 0,
				total_queries: data.total_queries || 0,
				timestamp: new Date().toISOString(),
			};

			await this.kv.put('metrics:database', JSON.stringify(metrics), {
				expirationTtl: 3600, // 1 hour TTL
			});

			// Store in history
			await this.storeMetricHistory(
				'db_avg_query_time',
				null,
				metrics.avg_query_time,
				'ms',
				metrics.total_queries
			);

			this.loggerInstance.info('Database metrics calculated', metrics);
		} catch (error) {
			this.loggerInstance.error('Failed to calculate database metrics', { error: String(error) });
		}
	}

	/**
	 * Run all metrics calculations in parallel
	 */
	async runAllMetricsCalculations(): Promise<void> {
		this.loggerInstance.info('Starting metrics calculation cycle');

		await Promise.allSettled([
			this.calculateLatencyPercentiles(),
			this.calculateErrorRate(),
			this.calculateSuccessRate(),
			this.calculateThroughput(),
			this.calculateQueueMetrics(),
			this.calculateEventLifecycleMetrics(),
			this.calculateCPUMetrics(),
			this.calculatePayloadMetrics(),
			this.calculateDatabaseMetrics(),
		]);

		this.loggerInstance.info('Metrics calculation cycle completed');
	}

	/**
	 * Calculate percentile using linear interpolation
	 * @param sortedArray - Array of numbers sorted in ascending order
	 * @param p - Percentile to calculate (0-100)
	 * @returns Percentile value
	 */
	private percentile(sortedArray: number[], p: number): number {
		if (sortedArray.length === 0) return 0;

		const index = (p / 100) * (sortedArray.length - 1);
		const lower = Math.floor(index);
		const upper = Math.ceil(index);
		const weight = index - lower;

		if (lower === upper) {
			return Math.round(sortedArray[lower] * 10) / 10;
		}

		const interpolated = sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
		return Math.round(interpolated * 10) / 10;
	}

	/**
	 * Validate that percentiles are in correct order (p50 <= p95 <= p99)
	 */
	private validatePercentileOrder(metrics: LatencyMetrics | CPUMetrics): boolean {
		return metrics.p50 <= metrics.p95 && metrics.p95 <= metrics.p99;
	}

	/**
	 * Store metric in D1 metrics_history table
	 */
	private async storeMetricHistory(
		type: string,
		endpoint: string | null,
		value: number,
		unit: string,
		dataPoints: number = 0
	): Promise<void> {
		try {
			const now = new Date().toISOString();
			const metricId = `${type}_${endpoint || 'global'}_${Date.now()}`;
			const confidence = dataPoints > 100 ? 1.0 : dataPoints > 0 ? dataPoints / 100 : 0.5;

			await this.db
				.prepare(
					`
        INSERT INTO metrics_history (metric_id, metric_type, endpoint, value, unit, timestamp, data_points, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
				)
				.bind(metricId, type, endpoint, value, unit, now, dataPoints, confidence)
				.run();
		} catch (error) {
			// Log but don't throw - metric history storage is non-critical
			this.loggerInstance.debug('Failed to store metric history', {
				type,
				endpoint,
				error: String(error),
			});
		}
	}
}
