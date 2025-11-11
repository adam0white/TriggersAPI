/**
 * Structured Logger Utility
 *
 * Provides JSON-formatted logging for Cloudflare Workers
 * - Consistent log format across all components
 * - Automatic timestamp injection
 * - Log level support (debug, info, warn, error)
 * - Context object merging for additional metadata
 *
 * Output format designed for Tail Worker capture and analysis
 */

export interface LogContext {
	[key: string]: any;
}

/**
 * Structured logger with JSON output
 * All logs include level, message, and timestamp
 * Additional context can be merged into each log entry
 */
export const logger = {
	/**
	 * Debug-level logging for detailed diagnostic information
	 * Use for verbose processing details during development
	 */
	debug(message: string, context?: LogContext) {
		console.log(
			JSON.stringify({
				level: 'debug',
				message,
				timestamp: new Date().toISOString(),
				...context,
			})
		);
	},

	/**
	 * Info-level logging for normal operational events
	 * Use for request processing, batch handling, successful operations
	 */
	info(message: string, context?: LogContext) {
		console.log(
			JSON.stringify({
				level: 'info',
				message,
				timestamp: new Date().toISOString(),
				...context,
			})
		);
	},

	/**
	 * Warning-level logging for potential issues
	 * Use for degraded performance, fallback scenarios, retry attempts
	 */
	warn(message: string, context?: LogContext) {
		console.warn(
			JSON.stringify({
				level: 'warn',
				message,
				timestamp: new Date().toISOString(),
				...context,
			})
		);
	},

	/**
	 * Error-level logging for failures and exceptions
	 * Use for processing failures, validation errors, service disruptions
	 */
	error(message: string, context?: LogContext) {
		console.error(
			JSON.stringify({
				level: 'error',
				message,
				timestamp: new Date().toISOString(),
				...context,
			})
		);
	},
};
