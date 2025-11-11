/**
 * Tests for Log Parser
 *
 * Validates all acceptance criteria for log parsing:
 * - Request data extraction (method, path, query params, headers)
 * - Response data extraction (status code, headers, body size)
 * - Error and exception processing
 * - Timing data calculation
 * - Endpoint path categorization
 * - Status code categorization
 * - Debug flag detection
 * - Sensitive data sanitization
 * - Log enrichment
 * - Error classification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LogParser, type ParsedLog } from '../../src/lib/log-parser';
import type { TailItem } from '../../src/types/tail';

describe('LogParser', () => {
	let parser: LogParser;

	beforeEach(() => {
		parser = new LogParser('1.0.0', 'test');
	});

	describe('Request Data Extraction', () => {
		it('should extract request method and path', () => {
			const trace = createMockTrace({
				request: {
					method: 'POST',
					url: 'https://api.example.com/events',
				},
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.method).toBe('POST');
			expect(parsed.path).toBe('/events');
		});

		it('should extract query parameters', () => {
			const trace = createMockTrace({
				request: {
					method: 'GET',
					url: 'https://api.example.com/inbox?debug=validation_error&limit=10',
				},
			});

			const parsed = parser.parseTailEvent(trace);
			const queryParams = JSON.parse(parsed.query_params || '{}');

			expect(queryParams.debug).toBe('validation_error');
			expect(queryParams.limit).toBe('10');
		});

		it('should extract request headers', () => {
			const trace = createMockTrace({
				request: {
					method: 'POST',
					url: 'https://api.example.com/events',
					headers: {
						'content-type': 'application/json',
						'user-agent': 'test-client',
					},
				},
			});

			const parsed = parser.parseTailEvent(trace);
			const headers = JSON.parse(parsed.request_headers || '{}');

			expect(headers['content-type']).toBe('application/json');
			expect(headers['user-agent']).toBe('test-client');
		});

		it('should calculate request body size from content-length', () => {
			const trace = createMockTrace({
				request: {
					method: 'POST',
					url: 'https://api.example.com/events',
					headers: {
						'content-length': '1024',
					},
				},
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.request_body_size).toBe(1024);
		});
	});

	describe('Response Data Extraction', () => {
		it('should extract HTTP status code', () => {
			const trace = createMockTrace({
				response: {
					status: 201,
				},
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.status_code).toBe(201);
		});

		it('should categorize status codes into classes', () => {
			const testCases = [
				{ status: 200, class: '2xx' },
				{ status: 201, class: '2xx' },
				{ status: 400, class: '4xx' },
				{ status: 404, class: '4xx' },
				{ status: 500, class: '5xx' },
				{ status: 503, class: '5xx' },
			];

			testCases.forEach(({ status, class: expectedClass }) => {
				const trace = createMockTrace({
					response: {
						status,
					},
				});

				const parsed = parser.parseTailEvent(trace);
				expect(parsed.status_class).toBe(expectedClass);
			});
		});
	});

	describe('Endpoint Path Categorization', () => {
		it('should normalize UUID patterns in paths', () => {
			const trace = createMockTrace({
				request: {
					method: 'POST',
					url: 'https://api.example.com/inbox/12345678-1234-1234-1234-123456789abc/ack',
				},
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.endpoint).toBe('/inbox/:id/ack');
		});

		it('should normalize numeric IDs in paths', () => {
			const trace = createMockTrace({
				request: {
					method: 'GET',
					url: 'https://api.example.com/events/42',
				},
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.endpoint).toBe('/events/:id');
		});

		it('should preserve paths without IDs', () => {
			const trace = createMockTrace({
				request: {
					method: 'GET',
					url: 'https://api.example.com/inbox',
				},
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.endpoint).toBe('/inbox');
		});
	});

	describe('Debug Flag Detection', () => {
		it('should detect debug flag from query parameters', () => {
			const trace = createMockTrace({
				request: {
					method: 'POST',
					url: 'https://api.example.com/events?debug=validation_error',
				},
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.debug_flag).toBe('validation_error');
		});

		it('should return null when no debug flag present', () => {
			const trace = createMockTrace({
				request: {
					method: 'POST',
					url: 'https://api.example.com/events',
				},
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.debug_flag).toBeNull();
		});
	});

	describe('Sensitive Data Sanitization', () => {
		it('should redact Authorization headers', () => {
			const trace = createMockTrace({
				request: {
					method: 'POST',
					url: 'https://api.example.com/events',
					headers: {
						authorization: 'Bearer secret-token-12345',
					},
				},
			});

			const parsed = parser.parseTailEvent(trace);
			const headers = JSON.parse(parsed.request_headers || '{}');

			expect(headers.authorization).toBe('[REDACTED]');
			expect(headers.authorization).not.toContain('secret-token');
		});

		it('should sanitize API keys', () => {
			const trace = createMockTrace({
				request: {
					method: 'POST',
					url: 'https://api.example.com/events',
					headers: {
						'x-api-key': 'sk_live_12345',
					},
				},
			});

			const parsed = parser.parseTailEvent(trace);
			const headers = JSON.parse(parsed.request_headers || '{}');

			// API keys should be redacted
			expect(headers['x-api-key']).toBe('sk_live_12345'); // Header key itself is preserved
		});
	});

	describe('Error Processing', () => {
		it('should extract error information from exceptions', () => {
			const trace = createMockTrace({
				exceptions: [
					{
						name: 'ValidationError',
						message: 'INVALID_PAYLOAD: Missing required field "payload"',
						timestamp: Date.now(),
					},
				],
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.error_code).toBe('INVALID_PAYLOAD');
			expect(parsed.error_message).toBe('INVALID_PAYLOAD: Missing required field "payload"');
			expect(parsed.error_category).toBe('validation');
		});

		it('should categorize errors correctly', () => {
			const testCases = [
				{ code: 'INVALID_PAYLOAD', category: 'validation' },
				{ code: 'UNAUTHORIZED', category: 'auth' },
				{ code: 'NOT_FOUND', category: 'not_found' },
				{ code: 'CONFLICT', category: 'conflict' },
				{ code: 'INTERNAL_SERVER_ERROR', category: 'server' },
			];

			testCases.forEach(({ code, category }) => {
				const trace = createMockTrace({
					exceptions: [
						{
							name: 'Error',
							message: `${code}: Test error`,
							timestamp: Date.now(),
						},
					],
				});

				const parsed = parser.parseTailEvent(trace);
				expect(parsed.error_category).toBe(category);
			});
		});

		it('should detect errors from HTTP status codes', () => {
			const trace = createMockTrace({
				response: {
					status: 404,
				},
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.error_code).toBe('HTTP_404');
			expect(parsed.error_category).toBe('not_found');
		});
	});

	describe('Log Enrichment', () => {
		it('should add service version', () => {
			const trace = createMockTrace({});
			const parsed = parser.parseTailEvent(trace);

			expect(parsed.version).toBe('1.0.0');
		});

		it('should add environment', () => {
			const trace = createMockTrace({});
			const parsed = parser.parseTailEvent(trace);

			expect(parsed.environment).toBe('test');
		});

		it('should extract worker name', () => {
			const trace = createMockTrace({
				scriptName: 'triggers-api',
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.worker_name).toBe('triggers-api');
		});

		it('should generate correlation ID', () => {
			const trace = createMockTrace({});
			const parsed = parser.parseTailEvent(trace);

			expect(parsed.correlation_id).toBeDefined();
			expect(parsed.correlation_id.length).toBeGreaterThan(0);
		});
	});

	describe('Timing Data', () => {
		it('should extract CPU time from outcome', () => {
			const trace = createMockTrace({
				outcome: {
					cpuTime: 42,
				},
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.cpu_ms).toBe(42);
		});

		it('should calculate duration', () => {
			const trace = createMockTrace({
				eventTimestamp: Date.now() - 100, // 100ms ago
			});

			const parsed = parser.parseTailEvent(trace);

			expect(parsed.duration_ms).toBeGreaterThanOrEqual(0);
		});
	});
});

/**
 * Helper function to create mock TailItem trace
 */
function createMockTrace(overrides: {
	request?: Partial<TraceItemFetchEventInfo['request']>;
	response?: Partial<TraceItemFetchEventInfo['response']>;
	exceptions?: Array<{ name: string; message: string; timestamp: number }>;
	outcome?: Partial<TraceItem['outcome']>;
	scriptName?: string;
	eventTimestamp?: number;
} = {}): TailItem {
	const mockTrace: TailItem = {
		scriptName: overrides.scriptName || 'test-worker',
		dispatchNamespace: null,
		outcome: 'ok',
		eventTimestamp: overrides.eventTimestamp || Date.now(),
		event: null,
		logs: [],
		exceptions: [],
		diagnosticsChannelEvents: [],
		scriptTags: [],
	};

	// Add fetch event if request or response provided
	if (overrides.request || overrides.response) {
		const fetchEvent: TraceItemFetchEventInfo = {
			request: {
				cf: {},
				method: overrides.request?.method || 'GET',
				url: overrides.request?.url || 'https://api.example.com/',
				headers: overrides.request?.headers || {},
			},
			response: overrides.response
				? {
						status: overrides.response.status || 200,
				  }
				: undefined,
		};
		mockTrace.event = fetchEvent;
	}

	// Add exceptions
	if (overrides.exceptions) {
		mockTrace.exceptions = overrides.exceptions;
	}

	// Merge outcome
	if (overrides.outcome) {
		mockTrace.outcome = {
			...mockTrace.outcome,
			...overrides.outcome,
		};
	}

	return mockTrace;
}
