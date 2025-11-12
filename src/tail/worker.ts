/**
 * Tail Worker Implementation
 *
 * Captures all Worker executions, console logs, and exceptions for observability.
 * Processes events and stores structured logs in D1 for dashboard consumption.
 *
 * Responsibilities:
 * - Receive TailEvent traces from all Worker invocations
 * - Extract console logs, exceptions, request/response data
 * - Parse structured logs for correlation IDs
 * - Batch insert logs into D1 database
 * - Handle errors gracefully without blocking system
 *
 * Configuration: Registered via tail_consumers in wrangler.toml
 */

import type { TailItem, TailLogEntry } from '../types/tail';
import { TailEventProcessor } from '../lib/tail-processor';

/**
 * Process Tail Worker events and store logs in D1
 *
 * Called automatically by Cloudflare for every Worker invocation
 * Non-blocking - failures don't impact main Worker operation
 *
 * @param events - Array of TraceItem (each represents one Worker invocation)
 * @param env - Cloudflare environment bindings
 */
export async function processTailEvents(events: TailItem[], env: Env): Promise<void> {
	try {
		// Process traces into structured log entries
		const allLogs = TailEventProcessor.processTraces(events);

		// Batch insert logs to D1
		if (allLogs.length > 0 && env.DB) {
			await batchInsertLogs(allLogs, env.DB);

			// Log success for debugging (this will also be captured by tail worker)
			console.log(
				JSON.stringify({
					level: 'info',
					message: 'Tail Worker processed traces',
					context: {
						traces: events.length,
						logs: allLogs.length,
					},
				}),
			);
		}
	} catch (error) {
		// Log error but don't throw - tail worker failures shouldn't break system
		console.error('Tail Worker error:', error);
	}
}

/**
 * Batch insert log entries into D1 database
 * Uses batching for efficiency (max 100 logs per batch)
 */
async function batchInsertLogs(logs: TailLogEntry[], db: D1Database): Promise<void> {
	const BATCH_SIZE = 100;
	const batches: TailLogEntry[][] = [];

	// Split logs into batches
	for (let i = 0; i < logs.length; i += BATCH_SIZE) {
		batches.push(logs.slice(i, i + BATCH_SIZE));
	}

	// Process each batch
	for (const batch of batches) {
		try {
			// Use D1 batch API for efficient insertion
			const statements = batch.map((log) => {
				return db
					.prepare(
						`INSERT INTO tail_logs (log_id, worker_name, request_id, correlation_id,
              log_level, message, context_json, timestamp, execution_time_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						log.log_id,
						log.worker_name,
						log.request_id,
						log.correlation_id,
						log.log_level,
						log.message,
						log.context_json,
						log.timestamp,
						log.execution_time_ms,
					);
			});

			// Execute batch
			await db.batch(statements);
		} catch (error) {
			// Log batch insertion failure but continue processing
			console.error('D1 batch insert failed:', error);
			// Could implement retry logic here with exponential backoff
		}
	}
}

/**
 * Retry batch insertion with exponential backoff
 * Implements 3 retry attempts with increasing delays
 */
async function retryBatchInsert(logs: TailLogEntry[], db: D1Database, maxRetries: number = 3): Promise<void> {
	let retries = 0;

	while (retries < maxRetries) {
		try {
			await batchInsertLogs(logs, db);
			return; // Success
		} catch (error) {
			retries++;
			if (retries >= maxRetries) {
				throw error; // Give up after max retries
			}

			// Exponential backoff: 100ms, 200ms, 400ms
			const delay = 100 * Math.pow(2, retries - 1);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
}
