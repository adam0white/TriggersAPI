/**
 * Queue Consumer Module
 *
 * Processes event batches from Cloudflare Queue
 * - Receives MessageBatch from queue binding
 * - Extracts individual messages and validates structure
 * - Processes messages in parallel for performance
 * - Handles errors without blocking batch processing
 * - Acks successful messages, nacks failed ones for retry
 * - Maintains correlation IDs for request tracing
 * - Structured logging for observability
 *
 * Queue Configuration (wrangler.toml):
 * - max_batch_size: 100 messages per batch
 * - max_batch_timeout: 1 second before partial batch (near real-time)
 * - max_retries: 3 retry attempts before DLQ
 * - max_concurrency: 10 parallel queue consumer instances
 * - dead_letter_queue: event-dlq for failed messages
 */

import { validateQueueMessage, QueueMessage } from './validation';
import { logger } from '../lib/logger';
import { ProcessEventInput } from '../workflows/process-event';

/**
 * Process batch of events from Cloudflare Queue
 *
 * Main entry point for queue consumer handler
 * - Receives batches of up to 100 messages
 * - Processes messages in parallel
 * - Tracks success/failure counts
 * - Acks successful messages, leaves failed for retry
 *
 * @param batch - MessageBatch from Cloudflare Queue binding
 * @param env - Cloudflare environment bindings
 */
export async function processEventBatch(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
	const batchSize = batch.messages.length;
	const batchId = crypto.randomUUID();

	logger.info('Queue batch received', {
		correlation_id: batchId,
		batch_id: batchId,
		batch_size: batchSize,
		queue_name: batch.queue,
	});

	// Process all messages in parallel for performance
	const results = await Promise.allSettled(batch.messages.map((message) => processMessage(message, env, batchId)));

	// Track processing results
	let successCount = 0;
	let failureCount = 0;

	// Ack/Nack messages based on processing results
	results.forEach((result, index) => {
		if (result.status === 'fulfilled') {
			successCount++;
			batch.messages[index].ack();
		} else {
			failureCount++;
			logger.error('Message processing failed', {
				correlation_id: batchId,
				batch_id: batchId,
				message_index: index,
				message_id: batch.messages[index].id,
				error: result.reason?.message || 'Unknown error',
				retry_count: batch.messages[index].attempts,
			});
			// Don't ack - message will be retried by queue
			// After max_retries exceeded, routes to DLQ automatically
		}
	});

	logger.info('Queue batch processing completed', {
		correlation_id: batchId,
		batch_id: batchId,
		successful: successCount,
		failed: failureCount,
		total: batchSize,
	});
}

/**
 * Process individual queue message
 *
 * - Validates message structure
 * - Extracts event data
 * - Triggers ProcessEventWorkflow for durable processing
 * - Logs processing details
 * - Returns promise (reject triggers retry)
 *
 * @param message - Individual message from batch
 * @param env - Cloudflare environment bindings
 * @param batchId - Batch correlation ID for tracing
 */
async function processMessage(message: Message<QueueMessage>, env: Env, batchId: string): Promise<void> {
	try {
		// Validate message structure
		const validatedMessage = validateQueueMessage(message.body);

		const { event_id, payload, metadata, timestamp, correlation_id } = validatedMessage;
		const correlationId = correlation_id || crypto.randomUUID();
		const retryCount = message.attempts;

		logger.debug('Processing queue message', {
			correlation_id: correlationId,
			event_id,
			batch_id: batchId,
			message_id: message.id,
			timestamp: message.timestamp.toISOString(),
			retry_attempt: retryCount,
		});

		logger.info('Triggering workflow for event', {
			correlation_id: correlationId,
			event_id,
			retry_attempt: retryCount,
			batch_id: batchId,
		});

		// Trigger ProcessEventWorkflow for durable multi-step processing
		// Workflow ID combines event_id and batchId for uniqueness and traceability
		const workflowId = `event-${event_id}-${batchId}`;

		const workflowInstance = await env.PROCESS_EVENT_WORKFLOW.create({
			id: workflowId,
			params: {
				event_id,
				payload,
				metadata,
				timestamp,
				correlation_id: correlationId,
				retry_attempt: retryCount,
			} as ProcessEventInput,
		});

		logger.info('Workflow created', {
			correlation_id: correlationId,
			event_id,
			workflow_id: workflowInstance.id,
			batch_id: batchId,
		});

		// Workflow is durable - we don't need to wait for completion
		// It will execute asynchronously with guaranteed completion
		// If we needed synchronous processing, we could await:
		// const result = await workflowInstance.result();

		return Promise.resolve();
	} catch (error) {
		// Validation or workflow creation error - log and reject
		const errorMessage = error instanceof Error ? error.message : String(error);

		logger.error('Queue message processing failed', {
			batch_id: batchId,
			message_id: message.id,
			error: errorMessage,
			retry_attempt: message.attempts,
		});

		// Throw to trigger queue retry logic
		throw new Error(`Message processing failed: ${errorMessage}`);
	}
}
