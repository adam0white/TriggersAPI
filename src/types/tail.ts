/**
 * Tail Worker Type Definitions
 *
 * TypeScript types for Cloudflare Tail Worker observability
 * Based on official Cloudflare Workers runtime API documentation
 *
 * Note: The actual Cloudflare runtime uses TraceItem[] (from worker-configuration.d.ts)
 * We re-export it with our naming for convenience
 */

/**
 * Re-export TraceItem from global types
 * This is the actual type used by Cloudflare's tail handler
 */
export type TailItem = TraceItem;
export type TailLog = TraceLog;
export type TailException = TraceException;

/**
 * Helper types for fetching event info
 * Re-export from global types
 */
export type FetchEventInfo = TraceItemFetchEventInfo;

/**
 * Structured log entry for D1 storage
 */
export interface TailLogEntry {
	log_id: string;
	worker_name: string;
	request_id: string | null;
	correlation_id: string | null;
	log_level: 'debug' | 'info' | 'warn' | 'error';
	message: string;
	context_json: string | null;
	timestamp: string;
	execution_time_ms: number | null;
}

/**
 * Parsed structured log from console.log output
 * Used for correlation ID extraction
 */
export interface StructuredConsoleLog {
	level?: string;
	message?: string;
	correlation_id?: string;
	timestamp?: string;
	context?: Record<string, unknown>;
}
