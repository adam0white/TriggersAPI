/**
 * Logs API - GET /api/logs
 *
 * Retrieves structured logs from the log_entries table with filtering support.
 * Used by the Live Tail Logs UI to display real-time system logs.
 *
 * Features:
 * - Filter by log level (debug, info, warn, error)
 * - Filter by worker name (api-worker, queue-consumer, etc.)
 * - Filter by endpoint (/events, /inbox, etc.)
 * - Search by message text or correlation ID
 * - Limit results (default 50, max 500)
 * - Returns newest logs first (DESC timestamp)
 *
 * Query Parameters:
 * - level: Log level filter (debug|info|warn|error)
 * - worker: Worker name filter
 * - endpoint: Endpoint filter
 * - search: Search in message or correlation_id
 * - limit: Number of logs to return (default 50, max 500)
 *
 * Response Format:
 * {
 *   "logs": LogEntry[],
 *   "count": number,
 *   "timestamp": string
 * }
 */

import { logger } from '../lib/logger';

export interface LogEntry {
	log_id: string;
	correlation_id: string;
	request_id?: string;
	timestamp: string;
	log_level: string; // debug, info, warn, error
	method?: string;
	path?: string;
	endpoint?: string;
	status_code?: number;
	status_class?: string;
	duration_ms?: number;
	cpu_ms?: number;
	db_query_ms?: number;
	queue_wait_ms?: number;
	error_code?: string;
	error_message?: string;
	error_category?: string;
	error_stack?: string;
	worker_name: string;
	debug_flag?: string;
	environment?: string;
	version?: string;
	created_at: string;
}

export interface LogsQueryParams {
	level?: string;
	worker?: string;
	endpoint?: string;
	search?: string;
	limit?: number;
}

/**
 * GET /api/logs - Query log entries with filters
 */
export async function handleGetLogs(request: Request, env: Env, correlationId: string): Promise<Response> {
	try {
		// Parse query parameters
		const url = new URL(request.url);
		const params = parseLogsQueryParams(url);

		// Build SQL query with filters
		const { query, bindings } = buildLogsQuery(params);

		// Execute query
		const result = await env.DB.prepare(query)
			.bind(...bindings)
			.all<LogEntry>();

		// Return response
		return new Response(
			JSON.stringify({
				logs: result.results || [],
				count: (result.results || []).length,
				timestamp: new Date().toISOString(),
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'x-correlation-id': correlationId,
				},
			},
		);
	} catch (error) {
		logger.error('Failed to fetch logs', {
			correlationId,
			error: String(error),
			message: error instanceof Error ? error.message : 'Unknown error',
		});

		return new Response(
			JSON.stringify({
				error: 'Failed to fetch logs',
				message: error instanceof Error ? error.message : 'Unknown error',
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'x-correlation-id': correlationId,
				},
			},
		);
	}
}

/**
 * Parse query parameters from URL
 */
function parseLogsQueryParams(url: URL): LogsQueryParams {
	const params: LogsQueryParams = {};

	// Log level filter
	const level = url.searchParams.get('level');
	if (level && ['debug', 'info', 'warn', 'error'].includes(level)) {
		params.level = level;
	}

	// Worker name filter
	const worker = url.searchParams.get('worker');
	if (worker) {
		params.worker = worker;
	}

	// Endpoint filter
	const endpoint = url.searchParams.get('endpoint');
	if (endpoint) {
		params.endpoint = endpoint;
	}

	// Search filter (message or correlation ID)
	const search = url.searchParams.get('search');
	if (search) {
		params.search = search.trim();
	}

	// Limit (default 50, max 500)
	const limitParam = url.searchParams.get('limit');
	let limit = 50;
	if (limitParam) {
		const parsedLimit = parseInt(limitParam, 10);
		if (!isNaN(parsedLimit) && parsedLimit > 0) {
			limit = Math.min(parsedLimit, 500);
		}
	}
	params.limit = limit;

	return params;
}

/**
 * Build SQL query with filters
 */
function buildLogsQuery(params: LogsQueryParams): { query: string; bindings: any[] } {
	const bindings: any[] = [];

	// Base query - select from log_entries table
	let query = `
		SELECT
			log_id,
			correlation_id,
			request_id,
			timestamp,
			log_level,
			method,
			path,
			endpoint,
			status_code,
			status_class,
			duration_ms,
			cpu_ms,
			db_query_ms,
			queue_wait_ms,
			error_code,
			error_message,
			error_category,
			error_stack,
			worker_name,
			debug_flag,
			environment,
			version,
			created_at
		FROM log_entries
		WHERE timestamp > datetime('now', '-1 hour')
	`;

	// Add log level filter
	if (params.level) {
		query += ` AND log_level = ?`;
		bindings.push(params.level);
	}

	// Add worker name filter
	if (params.worker) {
		query += ` AND worker_name = ?`;
		bindings.push(params.worker);
	}

	// Add endpoint filter
	if (params.endpoint) {
		query += ` AND endpoint = ?`;
		bindings.push(params.endpoint);
	}

	// Add search filter (search in message OR correlation_id)
	if (params.search) {
		query += ` AND (message LIKE ? OR correlation_id LIKE ?)`;
		const searchPattern = `%${params.search}%`;
		bindings.push(searchPattern, searchPattern);
	}

	// Order by timestamp DESC (newest first)
	query += ` ORDER BY timestamp DESC`;

	// Add limit
	query += ` LIMIT ?`;
	bindings.push(params.limit || 50);

	return { query, bindings };
}
