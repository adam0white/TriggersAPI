/**
 * Log Batch Processor
 *
 * Efficiently batches and inserts parsed log entries into D1 database.
 * Optimizes for D1 write performance by:
 * - Batching logs (up to 100 per batch)
 * - Periodic flushing (every 5 seconds)
 * - Handling backpressure gracefully
 * - Retry logic for failed inserts
 */

import type { ParsedLog } from './log-parser';

interface Logger {
	info: (message: string, context?: Record<string, unknown>) => void;
	error: (message: string, context?: Record<string, unknown>) => void;
	warn: (message: string, context?: Record<string, unknown>) => void;
}

export interface LogBatchProcessorConfig {
	maxBatchSize?: number; // Default: 100
	flushIntervalMs?: number; // Default: 5000 (5 seconds)
	maxRetries?: number; // Default: 3
}

export class LogBatchProcessor {
	private logBuffer: ParsedLog[] = [];
	private readonly maxBatchSize: number;
	private readonly flushIntervalMs: number;
	private readonly maxRetries: number;
	private flushTimer: ReturnType<typeof setTimeout> | null = null;
	private isFlushing = false;

	constructor(
		private readonly db: D1Database,
		private readonly logger: Logger,
		config: LogBatchProcessorConfig = {},
	) {
		this.maxBatchSize = config.maxBatchSize || 100;
		this.flushIntervalMs = config.flushIntervalMs || 5000;
		this.maxRetries = config.maxRetries || 3;
	}

	/**
	 * Add log to buffer and trigger flush if needed
	 */
	async addLog(log: ParsedLog): Promise<void> {
		this.logBuffer.push(log);

		// If buffer is full, flush immediately
		if (this.logBuffer.length >= this.maxBatchSize) {
			await this.flush();
		} else {
			// Schedule periodic flush
			this.scheduleFlush();
		}
	}

	/**
	 * Add multiple logs to buffer
	 */
	async addLogs(logs: ParsedLog[]): Promise<void> {
		this.logBuffer.push(...logs);

		// If buffer exceeds max size, flush immediately
		if (this.logBuffer.length >= this.maxBatchSize) {
			await this.flush();
		} else {
			// Schedule periodic flush
			this.scheduleFlush();
		}
	}

	/**
	 * Flush all buffered logs to D1
	 */
	async flush(): Promise<void> {
		// Prevent concurrent flushes
		if (this.isFlushing) {
			return;
		}

		// Nothing to flush
		if (this.logBuffer.length === 0) {
			return;
		}

		// Cancel scheduled flush since we're flushing now
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}

		this.isFlushing = true;

		// Take logs from buffer
		const logsToInsert = [...this.logBuffer];
		this.logBuffer = [];

		try {
			await this.insertLogsWithRetry(logsToInsert, this.maxRetries);

			this.logger.info('Successfully flushed logs to D1', {
				count: logsToInsert.length,
			});
		} catch (error) {
			this.logger.error('Failed to flush logs after retries', {
				error: String(error),
				logsLost: logsToInsert.length,
			});

			// Optionally: restore logs to buffer for retry
			// this.logBuffer = [...logsToInsert, ...this.logBuffer];
		} finally {
			this.isFlushing = false;
		}
	}

	/**
	 * Insert logs with retry logic
	 */
	private async insertLogsWithRetry(logs: ParsedLog[], retriesLeft: number): Promise<void> {
		try {
			await this.insertLogs(logs);
		} catch (error) {
			if (retriesLeft > 0) {
				this.logger.warn('Log insert failed, retrying...', {
					retriesLeft,
					error: String(error),
				});

				// Exponential backoff: wait 100ms, 200ms, 400ms
				const backoffMs = 100 * Math.pow(2, this.maxRetries - retriesLeft);
				await this.sleep(backoffMs);

				return this.insertLogsWithRetry(logs, retriesLeft - 1);
			}

			// No retries left, throw error
			throw error;
		}
	}

	/**
	 * Insert logs into D1 database
	 */
	private async insertLogs(logs: ParsedLog[]): Promise<void> {
		const insertStatement = `
			INSERT INTO log_entries (
				log_id, correlation_id, request_id, timestamp, method, path,
				endpoint, query_params, request_headers, request_body_size,
				status_code, status_class, response_headers, response_body_size,
				duration_ms, cpu_ms, db_query_ms, queue_wait_ms,
				error_code, error_message, error_category, error_stack,
				worker_name, debug_flag, environment, version
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`;

		// Use D1 batch API for efficiency
		const batch = logs.map((log) => {
			return this.db
				.prepare(insertStatement)
				.bind(
					log.log_id,
					log.correlation_id,
					log.request_id,
					log.timestamp,
					log.method,
					log.path,
					log.endpoint,
					log.query_params,
					log.request_headers,
					log.request_body_size,
					log.status_code,
					log.status_class,
					log.response_headers,
					log.response_body_size,
					log.duration_ms,
					log.cpu_ms,
					log.db_query_ms,
					log.queue_wait_ms,
					log.error_code,
					log.error_message,
					log.error_category,
					log.error_stack,
					log.worker_name,
					log.debug_flag,
					log.environment,
					log.version,
				);
		});

		// Execute batch insert
		await this.db.batch(batch);
	}

	/**
	 * Schedule periodic flush
	 */
	private scheduleFlush(): void {
		// If already scheduled, don't reschedule
		if (this.flushTimer) {
			return;
		}

		this.flushTimer = setTimeout(() => {
			this.flushTimer = null;
			this.flush().catch((error) => {
				this.logger.error('Scheduled flush failed', { error: String(error) });
			});
		}, this.flushIntervalMs);
	}

	/**
	 * Sleep helper for backoff
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Get current buffer size
	 */
	getBufferSize(): number {
		return this.logBuffer.length;
	}

	/**
	 * Check if flush is in progress
	 */
	isFlushinInProgress(): boolean {
		return this.isFlushing;
	}
}
