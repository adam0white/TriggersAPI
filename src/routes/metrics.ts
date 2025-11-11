/**
 * Metrics API Route
 *
 * GET /metrics - Retrieve current system metrics
 *
 * Returns aggregate counters, queue depth, and processing statistics
 * Used by dashboard UI for real-time monitoring
 *
 * Response format:
 * {
 *   "data": {
 *     "total_events": 1234,
 *     "pending": 45,
 *     "delivered": 1150,
 *     "failed": 39,
 *     "queue_depth": 12,
 *     "dlq_count": 3,
 *     "last_processed_at": "2025-11-10T12:34:56.789Z",
 *     "processing_rate": 60
 *   },
 *   "timestamp": "2025-11-10T12:35:00.000Z"
 * }
 */

import { MetricsManager } from '../lib/metrics';
import { logger } from '../lib/logger';

/**
 * Handle GET /metrics request
 *
 * Retrieves all metrics from KV and formats for API response
 * Non-authenticated endpoint (metrics are public for dashboard)
 *
 * @param request - HTTP request
 * @param env - Cloudflare Worker environment bindings
 * @param correlationId - Request correlation ID for tracing
 * @returns JSON response with metrics data or error
 */
export async function handleGetMetrics(
	request: Request,
	env: Env,
	correlationId: string
): Promise<Response> {
	logger.info('GET /metrics request received', {
		correlation_id: correlationId,
	});

	try {
		const metricsManager = new MetricsManager(env.METRICS_KV);
		const metrics = await metricsManager.getAllMetrics();

		logger.info('Metrics retrieved successfully', {
			correlation_id: correlationId,
			total_events: metrics.total_events,
			pending: metrics.pending,
		});

		return new Response(
			JSON.stringify({
				data: metrics,
				timestamp: new Date().toISOString(),
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'X-Correlation-ID': correlationId,
				},
			}
		);
	} catch (error) {
		logger.error('Failed to retrieve metrics', {
			correlation_id: correlationId,
			error: error instanceof Error ? error.message : 'Unknown',
		});

		return new Response(
			JSON.stringify({
				error: {
					code: 'METRICS_UNAVAILABLE',
					message: 'Failed to retrieve metrics',
					timestamp: new Date().toISOString(),
				},
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'X-Correlation-ID': correlationId,
				},
			}
		);
	}
}
