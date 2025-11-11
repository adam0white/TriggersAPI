/**
 * Log Parser
 *
 * Advanced log processing pipeline that parses raw Tail Worker events,
 * extracts request/response details, error information, and timing data.
 *
 * Features:
 * - Request/response data extraction
 * - Error classification and categorization
 * - Timing data calculation
 * - Endpoint path normalization
 * - Status code categorization
 * - Debug flag detection
 * - Sensitive data sanitization
 * - Log enrichment with metadata
 */

import type { TailItem } from '../types/tail';

export interface ParsedLog {
	log_id: string;
	correlation_id: string;
	request_id: string | null;
	timestamp: string;
	method: string;
	path: string;
	endpoint: string;
	query_params: string | null; // JSON string
	request_headers: string | null; // JSON string
	request_body_size: number;
	status_code: number;
	status_class: '2xx' | '4xx' | '5xx';
	response_headers: string | null; // JSON string
	response_body_size: number;
	duration_ms: number;
	cpu_ms: number | null;
	db_query_ms: number | null;
	queue_wait_ms: number | null;
	error_code: string | null;
	error_message: string | null;
	error_category: string | null;
	error_stack: string | null;
	worker_name: string;
	debug_flag: string | null;
	environment: string;
	version: string;
}

interface ParsedRequest {
	method: string;
	path: string;
	queryParams: Record<string, string>;
	headers: Record<string, string>;
	bodySize: number;
}

interface ParsedResponse {
	statusCode: number;
	headers: Record<string, string>;
	bodySize: number;
}

interface ParsedTiming {
	durationMs: number;
	cpuMs: number | null;
	dbMs: number | null;
	queueMs: number | null;
}

interface ParsedError {
	errorCode: string | null;
	errorMessage: string | null;
	errorCategory: string | null;
	errorStack: string | null;
}

export class LogParser {
	private readonly version: string;
	private readonly environment: string;

	// Sanitization patterns for sensitive data
	private readonly sanitizationPatterns = [
		{
			pattern: /Authorization:\s*Bearer\s+[^\s]+/gi,
			replacement: 'Authorization: Bearer [REDACTED]',
		},
		{
			pattern: /api[_-]?key[:\s=]+[^\s,}]+/gi,
			replacement: 'api_key: [REDACTED]',
		},
		{
			pattern: /token[:\s=]+[^\s,}]+/gi,
			replacement: 'token: [REDACTED]',
		},
		{
			pattern: /"password"\s*:\s*"[^"]+"/gi,
			replacement: '"password": "[REDACTED]"',
		},
	];

	constructor(version: string = '0.0.0', environment: string = 'development') {
		this.version = version;
		this.environment = environment;
	}

	/**
	 * Parse Tail Worker event into structured log entry
	 */
	parseTailEvent(trace: TailItem): ParsedLog {
		const logId = crypto.randomUUID();

		// Extract request metadata
		const request = this.parseRequest(trace);
		const endpoint = this.categorizeEndpoint(request.path);
		const debugFlag = this.extractDebugFlag(request.queryParams);

		// Extract response metadata
		const response = this.parseResponse(trace);
		const statusClass = this.getStatusClass(response.statusCode);

		// Extract timing data
		const timing = this.parseTiming(trace);

		// Extract error information
		const error = this.parseErrors(trace);

		// Extract correlation ID and request ID
		const correlationId = this.extractCorrelationId(trace);
		const requestId = this.extractRequestId(trace);

		// Get worker metadata
		const workerName = this.getWorkerName(trace);

		// Extract timestamp
		const timestamp = this.extractTimestamp(trace);

		return {
			log_id: logId,
			correlation_id: correlationId,
			request_id: requestId,
			timestamp,
			method: request.method,
			path: request.path,
			endpoint,
			query_params: Object.keys(request.queryParams).length > 0 ? JSON.stringify(request.queryParams) : null,
			request_headers: this.sanitizeAndSerialize(request.headers),
			request_body_size: request.bodySize,
			status_code: response.statusCode,
			status_class: statusClass,
			response_headers: this.sanitizeAndSerialize(response.headers),
			response_body_size: response.bodySize,
			duration_ms: timing.durationMs,
			cpu_ms: timing.cpuMs,
			db_query_ms: timing.dbMs,
			queue_wait_ms: timing.queueMs,
			error_code: error.errorCode,
			error_message: error.errorMessage,
			error_category: error.errorCategory,
			error_stack: error.errorStack,
			worker_name: workerName,
			debug_flag: debugFlag,
			environment: this.environment,
			version: this.version,
		};
	}

	/**
	 * Parse request data from Tail event
	 */
	private parseRequest(trace: TailItem): ParsedRequest {
		// Default values
		let method = 'GET';
		let path = '/';
		let queryParams: Record<string, string> = {};
		let headers: Record<string, string> = {};
		let bodySize = 0;

		// Check if this is a fetch event with request data
		if (trace.event && 'request' in trace.event) {
			const fetchEvent = trace.event as TraceItemFetchEventInfo;

			if (fetchEvent.request) {
				method = fetchEvent.request.method || 'GET';

				// Parse URL
				try {
					const url = new URL(fetchEvent.request.url);
					path = url.pathname;

					// Extract query parameters
					url.searchParams.forEach((value, key) => {
						queryParams[key] = value;
					});
				} catch {
					// If URL parsing fails, use raw URL as path
					path = fetchEvent.request.url || '/';
				}

				// Extract headers (if available)
				if (fetchEvent.request.headers) {
					Object.entries(fetchEvent.request.headers).forEach(([key, value]) => {
						headers[key.toLowerCase()] = String(value);
					});

					// Get body size from content-length header
					if (headers['content-length']) {
						bodySize = parseInt(headers['content-length'], 10) || 0;
					}
				}
			}
		}

		return { method, path, queryParams, headers, bodySize };
	}

	/**
	 * Parse response data from Tail event
	 */
	private parseResponse(trace: TailItem): ParsedResponse {
		let statusCode = 200;
		let headers: Record<string, string> = {};
		let bodySize = 0;

		// Try to get status from outcome (check if outcome is an object)
		if (trace.outcome && typeof trace.outcome === 'object' && 'status' in trace.outcome) {
			const outcome = trace.outcome as { status?: number };
			statusCode = outcome.status || 200;
		}

		// Check if response data is available
		if (trace.event && 'request' in trace.event) {
			const fetchEvent = trace.event as TraceItemFetchEventInfo;

			if (fetchEvent.response) {
				statusCode = fetchEvent.response.status || statusCode;
			}
		}

		return { statusCode, headers, bodySize };
	}

	/**
	 * Parse timing data from Tail event
	 */
	private parseTiming(trace: TailItem): ParsedTiming {
		let cpuMs: number | null = null;
		let durationMs = 0;

		// Extract CPU time from outcome (check if outcome is an object)
		if (trace.outcome && typeof trace.outcome === 'object' && 'cpuTime' in trace.outcome) {
			const outcome = trace.outcome as { cpuTime?: number };
			cpuMs = outcome.cpuTime || null;
		}

		// Calculate duration from event timestamp
		if (trace.eventTimestamp) {
			const eventTime = new Date(trace.eventTimestamp).getTime();
			const now = Date.now();
			durationMs = now - eventTime;
		}

		// If we have CPU time, use it as a fallback for duration
		if (cpuMs !== null && durationMs === 0) {
			durationMs = cpuMs;
		}

		return {
			durationMs,
			cpuMs,
			dbMs: null, // Would need to be extracted from structured logs
			queueMs: null, // Would need to be extracted from structured logs
		};
	}

	/**
	 * Parse error information from Tail event
	 */
	private parseErrors(trace: TailItem): ParsedError {
		// Check for exceptions
		if (trace.exceptions && trace.exceptions.length > 0) {
			const exception = trace.exceptions[0];
			const errorMessage = exception.message || 'Unknown error';
			const errorCode = this.extractErrorCode(errorMessage);
			const errorCategory = this.categorizeError(errorCode, exception.name || '');
			const errorStack = this.sanitizeStackTrace(exception.message || '');

			return {
				errorCode,
				errorMessage,
				errorCategory,
				errorStack,
			};
		}

		// Check if status code indicates error
		let statusCode = 200;
		if (trace.outcome && typeof trace.outcome === 'object' && 'status' in trace.outcome) {
			const outcome = trace.outcome as { status?: number };
			statusCode = outcome.status || 200;
		}

		// Also check response status from fetch event
		if (trace.event && 'request' in trace.event) {
			const fetchEvent = trace.event as TraceItemFetchEventInfo;
			if (fetchEvent.response && fetchEvent.response.status) {
				statusCode = fetchEvent.response.status;
			}
		}

		if (statusCode >= 400) {
			const errorCategory = statusCode >= 500 ? 'server' : this.categorizeErrorFromStatus(statusCode);
			return {
				errorCode: `HTTP_${statusCode}`,
				errorMessage: `HTTP ${statusCode} error`,
				errorCategory,
				errorStack: null,
			};
		}

		return {
			errorCode: null,
			errorMessage: null,
			errorCategory: null,
			errorStack: null,
		};
	}

	/**
	 * Extract correlation ID from trace logs
	 */
	private extractCorrelationId(trace: TailItem): string {
		// Try to find correlation_id in console logs
		if (trace.logs && trace.logs.length > 0) {
			for (const log of trace.logs) {
				if (log.message && Array.isArray(log.message)) {
					const firstMessage = log.message[0];
					if (typeof firstMessage === 'string') {
						try {
							const parsed = JSON.parse(firstMessage);
							if (parsed.correlation_id) {
								return parsed.correlation_id;
							}
						} catch {
							// Not JSON, continue
						}
					}
				}
			}
		}

		// Fallback: generate new UUID
		return crypto.randomUUID();
	}

	/**
	 * Extract request ID from trace
	 */
	private extractRequestId(trace: TailItem): string | null {
		// Cloudflare doesn't expose request ID in tail events
		// Could potentially extract from custom headers
		return null;
	}

	/**
	 * Extract timestamp from trace
	 */
	private extractTimestamp(trace: TailItem): string {
		if (trace.eventTimestamp) {
			return new Date(trace.eventTimestamp).toISOString();
		}

		// Fallback to current time
		return new Date().toISOString();
	}

	/**
	 * Categorize endpoint path (normalize IDs)
	 * Examples:
	 * - /inbox/12345678-1234-1234-1234-123456789abc/ack → /inbox/:id/ack
	 * - /events/42 → /events/:id
	 */
	private categorizeEndpoint(path: string): string {
		return (
			path
				// Replace UUIDs with :id
				.replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '/:id')
				// Replace numeric IDs with :id
				.replace(/\/\d+/g, '/:id')
		);
	}

	/**
	 * Get status code class (2xx, 4xx, 5xx)
	 */
	private getStatusClass(status: number): '2xx' | '4xx' | '5xx' {
		if (status >= 200 && status < 300) return '2xx';
		if (status >= 400 && status < 500) return '4xx';
		return '5xx';
	}

	/**
	 * Sanitize headers and serialize to JSON
	 */
	private sanitizeAndSerialize(data: Record<string, string>): string | null {
		if (Object.keys(data).length === 0) {
			return null;
		}

		const sanitized = this.sanitizeData(data);
		return JSON.stringify(sanitized);
	}

	/**
	 * Sanitize sensitive data from object
	 */
	private sanitizeData(data: Record<string, string>): Record<string, string> {
		const sanitized: Record<string, string> = {};

		Object.entries(data).forEach(([key, value]) => {
			let sanitizedValue = value;

			// Apply sanitization patterns
			this.sanitizationPatterns.forEach(({ pattern, replacement }) => {
				sanitizedValue = sanitizedValue.replace(pattern, replacement);
			});

			// Redact authorization header entirely
			if (key.toLowerCase() === 'authorization') {
				sanitizedValue = '[REDACTED]';
			}

			sanitized[key] = sanitizedValue;
		});

		return sanitized;
	}

	/**
	 * Sanitize stack trace
	 */
	private sanitizeStackTrace(stack: string): string {
		let sanitized = stack;

		// Apply sanitization patterns
		this.sanitizationPatterns.forEach(({ pattern, replacement }) => {
			sanitized = sanitized.replace(pattern, replacement);
		});

		return sanitized;
	}

	/**
	 * Extract debug flag from query parameters
	 */
	private extractDebugFlag(queryParams: Record<string, string>): string | null {
		if (queryParams.debug) {
			return queryParams.debug;
		}
		return null;
	}

	/**
	 * Extract error code from error message
	 * Example: "INVALID_PAYLOAD: Missing required field" → "INVALID_PAYLOAD"
	 */
	private extractErrorCode(message: string): string | null {
		const match = message.match(/^([A-Z_]+):/);
		return match?.[1] || null;
	}

	/**
	 * Categorize error by error code or exception name
	 */
	private categorizeError(errorCode: string | null, exceptionName: string): string {
		if (!errorCode && !exceptionName) return 'unknown';

		const errorStr = (errorCode || exceptionName).toUpperCase();

		if (errorStr.includes('INVALID') || errorStr.includes('VALIDATION')) return 'validation';
		if (errorStr.includes('UNAUTHORIZED') || errorStr.includes('AUTH')) return 'auth';
		if (errorStr.includes('NOT_FOUND') || errorStr.includes('NOTFOUND')) return 'not_found';
		if (errorStr.includes('CONFLICT')) return 'conflict';
		if (errorStr.includes('SERVER') || errorStr.includes('INTERNAL')) return 'server';

		return 'unknown';
	}

	/**
	 * Categorize error from HTTP status code
	 */
	private categorizeErrorFromStatus(status: number): string {
		switch (status) {
			case 400:
				return 'validation';
			case 401:
			case 403:
				return 'auth';
			case 404:
				return 'not_found';
			case 409:
				return 'conflict';
			default:
				return 'unknown';
		}
	}

	/**
	 * Get worker name from trace
	 */
	private getWorkerName(trace: TailItem): string {
		return trace.scriptName || 'unknown-worker';
	}
}
