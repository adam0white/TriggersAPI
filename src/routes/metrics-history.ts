/**
 * Metrics History API Route
 *
 * GET /api/metrics/history - Retrieve historical metrics for charting
 *
 * Query Parameters:
 * - time_range: 'last-hour' | 'last-6-hours' | 'last-24-hours' (default: 'last-hour')
 *
 * Returns historical metric snapshots from D1 and current metrics from KV
 * Used by enhanced metrics dashboard for trend charts and visualizations
 *
 * Response format:
 * {
 *   "historical": [
 *     {
 *       "timestamp": "2025-11-10T12:00:00.000Z",
 *       "latency_p50": 45.2,
 *       "latency_p95": 98.5,
 *       "latency_p99": 150.3,
 *       "error_rate": 2.1,
 *       "throughput_rps": 12.5,
 *       "queue_depth": 8
 *     }
 *   ],
 *   "current": {
 *     "latency_p50": 48.1,
 *     "latency_p95": 102.3,
 *     "latency_p99": 155.2,
 *     "error_rate": 1.9,
 *     "success_rate": 98.1,
 *     "throughput_rps": 13.2,
 *     "queue_depth": 7
 *   },
 *   "error_breakdown": {
 *     "validation": 5,
 *     "auth": 2,
 *     "not_found": 8,
 *     "conflict": 1,
 *     "server": 3
 *   },
 *   "timestamp": "2025-11-10T13:00:00.000Z"
 * }
 */

import { MetricsManager } from '../lib/metrics';
import { logger } from '../lib/logger';
import type { ExtendedMetrics } from '../types/metrics';

/**
 * Handle GET /api/metrics/history request
 *
 * Fetches historical metrics from D1 metrics_history table
 * and current metrics from KV for dashboard visualization
 *
 * @param request - HTTP request with query parameters
 * @param env - Cloudflare Worker environment bindings (DB, METRICS_KV)
 * @param correlationId - Request correlation ID for tracing
 * @returns JSON response with historical and current metrics or error
 */
export async function handleGetMetricsHistory(request: Request, env: Env, correlationId: string): Promise<Response> {
	const url = new URL(request.url);
	const timeRange = url.searchParams.get('time_range') || 'last-hour';

	logger.info('GET /api/metrics/history request received', {
		correlation_id: correlationId,
		time_range: timeRange,
	});

	try {
		// Determine hours to look back
		let hoursAgo = 1;
		if (timeRange === 'last-6-hours') hoursAgo = 6;
		else if (timeRange === 'last-24-hours') hoursAgo = 24;

		const startTime = new Date(Date.now() - hoursAgo * 3600000).toISOString();

		// Fetch historical metrics from D1
		const historicalResult = await env.DB.prepare(
			`SELECT
				timestamp,
				metric_type,
				endpoint,
				value,
				unit
			FROM metrics_history
			WHERE timestamp > ?
			ORDER BY timestamp ASC`,
		)
			.bind(startTime)
			.all();

		// Fetch current metrics from KV
		const metricsManager = new MetricsManager(env.METRICS_KV);
		const currentMetrics = await metricsManager.getAllMetrics();

		// Transform historical data into time-series format
		const historical = transformHistoricalData(historicalResult.results || []);

		// Fetch error breakdown from log_entries table
		const errorBreakdownResult = await env.DB.prepare(
			`SELECT
				COALESCE(error_category, 'unknown') as error_category,
				COUNT(*) as count
			FROM log_entries
			WHERE timestamp > ?
				AND error_category IS NOT NULL
			GROUP BY error_category`,
		)
			.bind(startTime)
			.all();

		const errorBreakdown: Record<string, number> = {
			validation: 0,
			auth: 0,
			not_found: 0,
			conflict: 0,
			server: 0,
		};

		if (errorBreakdownResult.results) {
			for (const row of errorBreakdownResult.results as any[]) {
				const category = row.error_category.toLowerCase();
				if (category in errorBreakdown) {
					errorBreakdown[category] = row.count;
				}
			}
		}

		// Calculate current metrics with success rate
		// Cast to ExtendedMetrics for additional computed properties
		const extendedMetrics = currentMetrics as unknown as ExtendedMetrics;
		const current = {
			latency_p50: extendedMetrics.latency_p50 || 0,
			latency_p95: extendedMetrics.latency_p95 || 0,
			latency_p99: extendedMetrics.latency_p99 || 0,
			error_rate: calculateErrorRate(extendedMetrics),
			success_rate: 100 - calculateErrorRate(extendedMetrics),
			throughput_rps: extendedMetrics.throughput_rps || 0,
			queue_depth: currentMetrics.queue_depth || 0,
			cpu_p50: extendedMetrics.cpu_p50 || 0,
			cpu_p95: extendedMetrics.cpu_p95 || 0,
		};

		logger.info('Metrics history retrieved successfully', {
			correlation_id: correlationId,
			historical_count: historical.length,
			time_range: timeRange,
		});

		return new Response(
			JSON.stringify({
				historical,
				current,
				error_breakdown: errorBreakdown,
				timestamp: new Date().toISOString(),
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'X-Correlation-ID': correlationId,
				},
			},
		);
	} catch (error) {
		logger.error('Failed to retrieve metrics history', {
			correlation_id: correlationId,
			error: error instanceof Error ? error.message : 'Unknown',
			stack: error instanceof Error ? error.stack : undefined,
		});

		return new Response(
			JSON.stringify({
				error: {
					code: 'METRICS_HISTORY_UNAVAILABLE',
					message: 'Failed to retrieve metrics history',
					timestamp: new Date().toISOString(),
				},
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'X-Correlation-ID': correlationId,
				},
			},
		);
	}
}

/**
 * Transform flat historical metric rows into time-series format
 * Groups metrics by timestamp for charting
 *
 * @param rows - Raw metric rows from database
 * @returns Array of time-series data points
 */
function transformHistoricalData(rows: any[]): any[] {
	const dataByTimestamp: Record<string, any> = {};

	for (const row of rows) {
		const timestamp = row.timestamp;

		if (!dataByTimestamp[timestamp]) {
			dataByTimestamp[timestamp] = { timestamp };
		}

		// Map metric_type to field name
		const metricKey = row.metric_type;
		dataByTimestamp[timestamp][metricKey] = row.value;
	}

	return Object.values(dataByTimestamp);
}

/**
 * Calculate error rate from metrics
 * Error rate = (failed / total_events) * 100
 *
 * @param metrics - Current metrics object (base Metrics type)
 * @returns Error rate as percentage
 */
function calculateErrorRate(metrics: ExtendedMetrics): number {
	const total = metrics.total_events || 0;
	const failed = metrics.failed || 0;

	if (total === 0) return 0;

	return parseFloat(((failed / total) * 100).toFixed(2));
}
