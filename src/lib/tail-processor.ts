/**
 * Tail Event Processor
 *
 * Processes Tail Worker events and transforms them into structured log entries
 * for storage in D1 database. Handles:
 * - Console log extraction and parsing
 * - Exception capture
 * - Request/response metadata extraction
 * - Correlation ID tracking
 * - Structured JSON formatting
 */

import type {
	TailItem,
	TailLog,
	TailException,
	TailLogEntry,
	StructuredConsoleLog,
} from '../types/tail';

export class TailEventProcessor {
	/**
	 * Process array of TailItem traces into structured log entries
	 */
	static processTraces(traces: TailItem[]): TailLogEntry[] {
		const logs: TailLogEntry[] = [];

		for (const trace of traces) {
			// Extract worker name from script name
			const workerName = this.extractWorkerName(trace.scriptName);

			// Extract request ID if available
			const requestId = this.extractRequestId(trace);

			// Process console logs
			for (const log of trace.logs) {
				const logEntry = this.processConsoleLog(log, trace, workerName, requestId);
				logs.push(logEntry);
			}

			// Process exceptions
			for (const exception of trace.exceptions) {
				const exceptionEntry = this.processException(exception, trace, workerName, requestId);
				logs.push(exceptionEntry);
			}

			// If no logs or exceptions, create a summary entry for the invocation
			if (trace.logs.length === 0 && trace.exceptions.length === 0) {
				const summaryEntry = this.createSummaryEntry(trace, workerName, requestId);
				logs.push(summaryEntry);
			}
		}

		return logs;
	}

	/**
	 * Extract worker name from script name
	 * Examples: "triggers-api" -> "triggers-api"
	 */
	private static extractWorkerName(scriptName: string | null): string {
		// Default to script name if no pattern matches
		return scriptName || 'unknown-worker';
	}

	/**
	 * Extract request ID from trace event metadata
	 * This would come from Cloudflare's internal request tracking
	 */
	private static extractRequestId(trace: TailItem): string | null {
		// Request ID might be in trace metadata or headers
		// For now, return null - Cloudflare doesn't expose this directly
		return null;
	}

	/**
	 * Process console log into structured entry
	 */
	private static processConsoleLog(
		log: TailLog,
		trace: TailItem,
		workerName: string,
		requestId: string | null
	): TailLogEntry {
		// Parse message - TraceLog.message is any[], not unknown[]
		const message = (log.message || []) as unknown[];
		const parsedLog = this.parseLogMessage(message);

		// Extract correlation ID from structured log
		const correlationId = parsedLog.correlation_id || crypto.randomUUID();

		// Map log level (handle 'log' as 'info')
		const level = log.level || 'info';
		const logLevel = level === 'log' ? 'info' : (level as 'debug' | 'info' | 'warn' | 'error');

		// Build context object
		const context: Record<string, unknown> = {
			outcome: trace.outcome,
			scriptName: trace.scriptName,
		};

		// Add request/response data if available (check for fetch event)
		if (trace.event && 'request' in trace.event) {
			const fetchEvent = trace.event as TraceItemFetchEventInfo;
			context.request = {
				method: fetchEvent.request.method,
				url: fetchEvent.request.url,
			};

			if (fetchEvent.response) {
				context.response = {
					status: fetchEvent.response.status,
				};
			}
		}

		// Merge with any context from structured log
		if (parsedLog.context) {
			Object.assign(context, parsedLog.context);
		}

		return {
			log_id: crypto.randomUUID(),
			worker_name: workerName,
			request_id: requestId,
			correlation_id: correlationId,
			log_level: logLevel,
			message: parsedLog.message || this.formatMessage(message),
			context_json: JSON.stringify(context),
			timestamp: new Date(log.timestamp).toISOString(),
			execution_time_ms: null, // CPU time not available per log
		};
	}

	/**
	 * Process exception into structured entry
	 */
	private static processException(
		exception: TailException,
		trace: TailItem,
		workerName: string,
		requestId: string | null
	): TailLogEntry {
		// Build context with exception details
		const context: Record<string, unknown> = {
			outcome: trace.outcome,
			scriptName: trace.scriptName,
			exceptionName: exception.name,
			exceptionMessage: exception.message,
		};

		// Add request data if available (check for fetch event)
		if (trace.event && 'request' in trace.event) {
			const fetchEvent = trace.event as TraceItemFetchEventInfo;
			context.request = {
				method: fetchEvent.request.method,
				url: fetchEvent.request.url,
			};
		}

		return {
			log_id: crypto.randomUUID(),
			worker_name: workerName,
			request_id: requestId,
			correlation_id: crypto.randomUUID(), // Exceptions may not have correlation ID
			log_level: 'error',
			message: `${exception.name}: ${exception.message}`,
			context_json: JSON.stringify(context),
			timestamp: new Date(exception.timestamp).toISOString(),
			execution_time_ms: null,
		};
	}

	/**
	 * Create summary entry for invocation with no logs/exceptions
	 */
	private static createSummaryEntry(
		trace: TailItem,
		workerName: string,
		requestId: string | null
	): TailLogEntry {
		const context: Record<string, unknown> = {
			outcome: trace.outcome,
			scriptName: trace.scriptName,
		};

		// Add request data if available (check for fetch event)
		if (trace.event && 'request' in trace.event) {
			const fetchEvent = trace.event as TraceItemFetchEventInfo;
			context.request = {
				method: fetchEvent.request.method,
				url: fetchEvent.request.url,
			};

			if (fetchEvent.response) {
				context.response = {
					status: fetchEvent.response.status,
				};
			}
		}

		const timestamp = trace.eventTimestamp ? new Date(trace.eventTimestamp).toISOString() : new Date().toISOString();

		return {
			log_id: crypto.randomUUID(),
			worker_name: workerName,
			request_id: requestId,
			correlation_id: crypto.randomUUID(),
			log_level: 'info',
			message: `Worker invocation: ${trace.outcome}`,
			context_json: JSON.stringify(context),
			timestamp: timestamp,
			execution_time_ms: null,
		};
	}

	/**
	 * Parse log message - handles both structured JSON and plain text
	 */
	private static parseLogMessage(message: unknown[]): StructuredConsoleLog {
		// If message is empty, return empty object
		if (!message || message.length === 0) {
			return {};
		}

		// Try to parse first message as JSON (structured logging)
		const firstMessage = message[0];
		if (typeof firstMessage === 'string') {
			try {
				const parsed = JSON.parse(firstMessage);
				if (typeof parsed === 'object' && parsed !== null) {
					return parsed as StructuredConsoleLog;
				}
			} catch {
				// Not JSON, treat as plain text
			}
		}

		// If structured parsing failed, return plain message
		return {
			message: this.formatMessage(message),
		};
	}

	/**
	 * Format message array into readable string
	 */
	private static formatMessage(message: unknown[]): string {
		return message
			.map((item) => {
				if (typeof item === 'string') {
					return item;
				} else if (typeof item === 'object') {
					return JSON.stringify(item);
				}
				return String(item);
			})
			.join(' ');
	}
}
