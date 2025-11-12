/**
 * Structured Logging Module
 *
 * Provides structured JSON logging for all application events.
 * All logs include: level, message, timestamp, correlation_id (when applicable).
 *
 * Log Levels:
 * - debug: Detailed debugging information
 * - info: General informational messages
 * - warn: Warning messages (e.g., auth failures)
 * - error: Error conditions (e.g., validation failures, service errors)
 *
 * Sensitive Data Handling:
 * - NEVER log: Bearer tokens, full payloads, user PII
 * - ALWAYS log: correlation_id, error codes, timestamps, component names
 */

export interface LogContext {
	[key: string]: any;
}

interface BaseLogEntry {
	level: 'debug' | 'info' | 'warn' | 'error';
	message: string;
	timestamp: string;
	correlation_id?: string;
}

/**
 * Sanitize sensitive data from log context
 * Removes or redacts tokens, credentials, and PII
 *
 * @param context - Log context object
 * @returns Sanitized context
 */
function sanitizeContext(context: LogContext): LogContext {
	const sanitized = { ...context };

	// Remove or redact sensitive fields
	const sensitiveFields = ['token', 'authorization', 'bearer', 'password', 'secret', 'apiKey', 'api_key'];

	for (const key of Object.keys(sanitized)) {
		const lowerKey = key.toLowerCase();
		if (sensitiveFields.some((field) => lowerKey.includes(field))) {
			sanitized[key] = '[REDACTED]';
		}
	}

	return sanitized;
}

/**
 * Create structured log entry
 *
 * @param level - Log level
 * @param message - Log message
 * @param context - Additional context (sanitized automatically)
 * @returns Structured log entry
 */
function createLogEntry(level: BaseLogEntry['level'], message: string, context: LogContext = {}): BaseLogEntry {
	const sanitized = sanitizeContext(context);

	// Normalize correlationId to correlation_id for tail worker compatibility
	if ('correlationId' in sanitized && !('correlation_id' in sanitized)) {
		sanitized.correlation_id = sanitized.correlationId;
		delete sanitized.correlationId;
	}

	return {
		level,
		message,
		timestamp: new Date().toISOString(),
		...sanitized,
	};
}

/**
 * Log debug message
 * Use for detailed debugging information
 *
 * @param message - Debug message
 * @param context - Additional context
 */
export function logDebug(message: string, context: LogContext = {}): void {
	const entry = createLogEntry('debug', message, context);
	console.log(JSON.stringify(entry));
}

/**
 * Log info message
 * Use for general informational messages
 *
 * @param message - Info message
 * @param context - Additional context
 */
export function logInfo(message: string, context: LogContext = {}): void {
	const entry = createLogEntry('info', message, context);
	console.log(JSON.stringify(entry));
}

/**
 * Log warning message
 * Use for warning conditions (e.g., auth failures, deprecated usage)
 *
 * @param context - Warning context with message
 */
export function logWarning(context: LogContext & { message: string }): void {
	const { message, ...rest } = context;
	const entry = createLogEntry('warn', message, rest);
	console.warn(JSON.stringify(entry));
}

/**
 * Log error message
 * Use for error conditions (validation failures, service errors, exceptions)
 *
 * @param context - Error context with message
 */
export function logError(context: LogContext & { message: string }): void {
	const { message, ...rest } = context;
	const entry = createLogEntry('error', message, rest);
	console.error(JSON.stringify(entry));
}

/**
 * Log validation failure
 * Specialized logging for validation errors
 *
 * @param code - Error code
 * @param correlationId - Request correlation ID
 * @param field - Field that failed validation
 * @param reason - Reason for validation failure
 */
export function logValidationError(code: string, correlationId: string, field: string, reason: string): void {
	logError({
		message: 'Validation failed',
		code,
		correlationId,
		context: {
			field,
			reason,
		},
	});
}

/**
 * Log authentication failure
 * Specialized logging for auth errors
 *
 * @param code - Error code
 * @param correlationId - Request correlation ID
 * @param reason - Reason for auth failure
 */
export function logAuthFailure(code: string, correlationId: string, reason: string): void {
	logWarning({
		message: 'Authentication failed',
		code,
		correlationId,
		reason,
	});
}

/**
 * Log queue operation
 * Specialized logging for queue send/receive operations
 *
 * @param operation - Operation type (send, receive, retry, dlq)
 * @param correlationId - Request correlation ID
 * @param eventId - Event ID
 * @param success - Whether operation succeeded
 * @param error - Optional error message
 */
export function logQueueOperation(
	operation: 'send' | 'receive' | 'retry' | 'dlq',
	correlationId: string,
	eventId: string,
	success: boolean,
	error?: string,
): void {
	const level = success ? 'info' : 'error';
	const message = `Queue ${operation} ${success ? 'succeeded' : 'failed'}`;

	if (success) {
		logInfo(message, {
			operation,
			correlationId,
			eventId,
		});
	} else {
		logError({
			message,
			operation,
			correlationId,
			eventId,
			error,
		});
	}
}

/**
 * Log request
 * Log incoming HTTP request (without sensitive data)
 *
 * @param method - HTTP method
 * @param path - Request path
 * @param correlationId - Request correlation ID
 * @param statusCode - Response status code
 * @param duration - Request duration in milliseconds
 */
export function logRequest(method: string, path: string, correlationId: string, statusCode: number, duration?: number): void {
	logInfo('Request processed', {
		method,
		path,
		correlationId,
		statusCode,
		duration_ms: duration,
	});
}
