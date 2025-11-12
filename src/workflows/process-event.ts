/**
 * Process Event Workflow
 *
 * Cloudflare Workflow for durable, multi-step event processing
 * - Step 1: Validate event structure and required fields
 * - Step 2: Store event to D1 database with status='pending'
 * - Step 3: Update KV metrics counters (increment pending, total)
 * - Step 4: Mark event as delivered (update status, adjust metrics)
 *
 * Workflow Features:
 * - Durable execution with automatic state persistence
 * - Independent retry logic for each step
 * - Exponential backoff on failures
 * - Idempotent operations for safe retries
 * - Correlation ID propagation for request tracing
 *
 * Configuration (wrangler.toml):
 * - binding: PROCESS_EVENT_WORKFLOW
 * - name: process-event-workflow
 * - class_name: ProcessEventWorkflow
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { logger } from '../lib/logger';
import { EventQueries } from '../db/queries';
import { MetricsManager } from '../lib/metrics';

/**
 * Input payload for ProcessEventWorkflow
 * Passed from queue consumer for each event
 */
export interface ProcessEventInput {
	event_id: string;
	payload: Record<string, any>;
	metadata?: Record<string, any>;
	timestamp: string;
	correlation_id: string;
	retry_attempt: number;
}

/**
 * Output result from ProcessEventWorkflow
 * Indicates success/failure and stores processing details
 */
export interface ProcessEventOutput {
	event_id: string;
	status: 'success' | 'failure';
	stored_at?: string;
	error?: string;
}

/**
 * ProcessEventWorkflow - Durable multi-step event processing
 *
 * Handles guaranteed execution of:
 * 1. Event validation (structure, required fields)
 * 2. D1 storage (status=pending, with timestamps)
 * 3. KV metrics update (increment counters)
 *
 * Each step can retry independently on failure
 * Failed workflows after max retries route to DLQ
 */
export class ProcessEventWorkflow extends WorkflowEntrypoint<Env, ProcessEventInput> {
	async run(event: WorkflowEvent<ProcessEventInput>, step: WorkflowStep): Promise<ProcessEventOutput> {
		const input = event.payload;
		const { event_id, payload, metadata, timestamp, correlation_id, retry_attempt } = input;

		logger.info('Workflow started', {
			correlation_id,
			event_id,
			retry_attempt,
		});

		try {
			// Step 1: Validate event structure
			const validated = await step.do('validate-event', async () => {
				logger.debug('Validating event', {
					correlation_id,
					event_id,
				});

				// Validate event_id
				if (!event_id || typeof event_id !== 'string') {
					throw new Error('Invalid event_id: must be non-empty string');
				}

				// Validate payload
				if (!payload || typeof payload !== 'object') {
					throw new Error('Invalid payload: must be object');
				}

				// Metadata is optional, but must be object if present
				if (metadata !== undefined && metadata !== null && typeof metadata !== 'object') {
					throw new Error('Invalid metadata: must be object if present');
				}

				logger.info('Event validation passed', {
					correlation_id,
					event_id,
				});

				return {
					event_id,
					payload,
					metadata,
					timestamp,
					correlation_id,
				};
			});

			// Step 2: Store event in D1 database
			const stored = await step.do('store-event', async () => {
				logger.debug('Storing event to D1', {
					correlation_id,
					event_id,
				});

				const queries = new EventQueries(this.env.DB);

				try {
					const storedEvent = await queries.createEvent(event_id, payload, metadata, timestamp, retry_attempt);

					logger.info('Event stored successfully', {
						correlation_id,
						event_id,
						status: storedEvent.status,
						stored_at: storedEvent.updated_at,
					});

					return {
						event_id: storedEvent.event_id,
						status: storedEvent.status,
						stored_at: storedEvent.updated_at,
					};
				} catch (error) {
					logger.error('Failed to store event', {
						correlation_id,
						event_id,
						error: error instanceof Error ? error.message : 'Unknown',
					});
					throw error; // Workflow retry
				}
			});

			// Step 3: Update metrics in KV
			const metrics = await step.do('update-metrics', async () => {
				logger.debug('Updating metrics', {
					correlation_id,
					event_id,
				});

				try {
					const metricsManager = new MetricsManager(this.env.METRICS_KV);

					// Calculate processing time from event timestamp
					const processingTimeMs = Date.now() - new Date(timestamp).getTime();

					// Record event storage with processing time
					// New events always start with status='pending'
					await metricsManager.recordEventStored(event_id, 'pending', processingTimeMs);

					logger.info('Metrics updated successfully', {
						correlation_id,
						event_id,
						processing_time_ms: processingTimeMs,
					});

					return {
						total_updated: true,
						metrics_recorded: true,
					};
				} catch (error) {
					// Log but don't fail - metrics are secondary
					logger.warn('Metrics update failed but continuing', {
						correlation_id,
						event_id,
						error: error instanceof Error ? error.message : 'Unknown',
					});

					return {
						total_updated: false,
						metrics_recorded: false,
					};
				}
			});

			// Step 4: Mark event as delivered after successful processing
			await step.do('mark-delivered', async () => {
				logger.debug('Marking event as delivered', {
					correlation_id,
					event_id,
				});

				try {
					const queries = new EventQueries(this.env.DB);
					const metricsManager = new MetricsManager(this.env.METRICS_KV);

					// Update event status in D1 from 'pending' to 'delivered'
					await queries.updateEventStatus(event_id, 'delivered');

					// Update metrics: decrement pending, increment delivered
					await metricsManager.recordStatusChange(event_id, 'pending', 'delivered');

					logger.info('Event marked as delivered', {
						correlation_id,
						event_id,
					});

					return {
						status_updated: true,
					};
				} catch (error) {
					logger.error('Failed to mark event as delivered', {
						correlation_id,
						event_id,
						error: error instanceof Error ? error.message : 'Unknown',
					});
					// Log but don't fail entire workflow
					return {
						status_updated: false,
					};
				}
			});

			logger.info('Workflow completed successfully', {
				correlation_id,
				event_id,
				duration_ms: Date.now() - new Date(timestamp).getTime(),
			});

			return {
				event_id,
				status: 'success',
				stored_at: stored.stored_at,
			};
		} catch (error) {
			logger.error('Workflow failed', {
				correlation_id,
				event_id,
				error: error instanceof Error ? error.message : 'Unknown error',
				retry_attempt,
			});

			return {
				event_id,
				status: 'failure',
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}
}
