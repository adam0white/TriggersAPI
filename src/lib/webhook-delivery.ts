/**
 * Webhook Delivery Service
 * Epic 8.3: Event Delivery - Push Events to Zapier Webhooks
 * Epic 8.4: Security & Validation - HMAC Signature Generation
 *
 * Handles delivery of events to registered Zapier webhook URLs
 * - Fetches active webhooks from database
 * - Delivers events via HTTP POST with retry logic
 * - Implements exponential backoff (2s, 4s, 8s, 16s)
 * - Tracks delivery metrics (success/failure)
 * - Updates webhook status based on delivery results
 * - Non-blocking delivery (fire-and-forget)
 * - Signs webhook deliveries with HMAC-SHA256 (Epic 8.4)
 */

import { ZapierWebhookSubscription, ZapierTestResponse } from '../types/api';
import { logger } from './logger';
import { SignatureService } from './signature-service';
import { validateZapierEvent } from './zapier-schema';

/**
 * Result of a single webhook delivery attempt
 */
export interface WebhookDeliveryResult {
	webhook_id: string;
	url: string;
	success: boolean;
	status_code?: number;
	error?: string;
	attempt: number;
	retry_after?: number;
}

/**
 * WebhookDeliveryService
 *
 * Core service for delivering events to Zapier webhooks
 * Handles retry logic, error tracking, and metrics
 */
export class WebhookDeliveryService {
	private static readonly TIMEOUT_MS = 5000; // 5 second timeout
	private static readonly MAX_RETRIES = 4; // Max 4 retry attempts (initial + 3 retries)
	private static readonly BACKOFF_DELAYS = [2000, 4000, 8000, 16000]; // Exponential backoff in ms

	/**
	 * Deliver event to all active Zapier webhooks
	 * Non-blocking - processes deliveries without blocking caller
	 *
	 * @param event - Event data to deliver
	 * @param env - Cloudflare environment bindings
	 * @param eventId - Unique event identifier
	 * @param correlationId - Request correlation ID for tracing
	 */
	static async deliverEventToWebhooks(
		event: ZapierTestResponse,
		env: Env,
		eventId: string,
		correlationId: string
	): Promise<void> {
		try {
			logger.info('Starting webhook delivery', {
				correlation_id: correlationId,
				event_id: eventId,
			});

			// Fetch all active webhooks from database
			const webhooks = await env.DB.prepare(
				`SELECT id, url, status FROM zapier_webhooks
         WHERE status = 'active'
         ORDER BY created_at DESC`
			).all<ZapierWebhookSubscription>();

			if (!webhooks.results || webhooks.results.length === 0) {
				logger.info('No active webhooks found for delivery', {
					correlation_id: correlationId,
					event_id: eventId,
				});
				return;
			}

			logger.info('Delivering event to webhooks', {
				correlation_id: correlationId,
				event_id: eventId,
				webhook_count: webhooks.results.length,
			});

			// Deliver to each webhook (fire-and-forget)
			// Use Promise.allSettled to continue even if some fail
			const deliveryPromises = webhooks.results.map((webhook) =>
				this.deliverToWebhook(webhook, event, eventId, correlationId, env)
			);

			// Wait for all deliveries to complete but don't block on failures
			await Promise.allSettled(deliveryPromises);

			logger.info('Webhook delivery batch completed', {
				correlation_id: correlationId,
				event_id: eventId,
				total_webhooks: webhooks.results.length,
			});
		} catch (error) {
			logger.error('Webhook delivery batch failed', {
				correlation_id: correlationId,
				event_id: eventId,
				error: error instanceof Error ? error.message : String(error),
			});
			// Don't throw - webhook delivery failures should not block event processing
		}
	}

	/**
	 * Deliver event to a single webhook with retry logic
	 *
	 * Implements:
	 * - Exponential backoff retry
	 * - 5-second timeout per attempt
	 * - Status tracking (active/failing)
	 * - Correlation ID header
	 * - DLQ logging for failures
	 * - HMAC-SHA256 signature generation (Epic 8.4)
	 * - Event payload validation (Epic 8.4)
	 *
	 * @param webhook - Webhook subscription record
	 * @param event - Event data to deliver
	 * @param eventId - Event identifier
	 * @param correlationId - Correlation ID for tracing
	 * @param env - Cloudflare environment bindings
	 */
	private static async deliverToWebhook(
		webhook: ZapierWebhookSubscription,
		event: ZapierTestResponse,
		eventId: string,
		correlationId: string,
		env: Env
	): Promise<void> {
		let lastError: string = '';
		let lastStatusCode: number | undefined;

		// Validate event payload before delivery (Epic 8.4)
		const validation = validateZapierEvent(event);
		if (!validation.valid) {
			logger.error('Event validation failed before delivery', {
				correlation_id: correlationId,
				event_id: eventId,
				webhook_id: webhook.id,
				validation_errors: validation.errors,
			});
			lastError = `Event validation failed: ${validation.errors.map((e) => e.message).join(', ')}`;

			// Update webhook with validation error
			await env.DB.prepare(
				`UPDATE zapier_webhooks
         SET last_error = ?
         WHERE id = ?`
			)
				.bind(lastError, webhook.id)
				.run();

			await this.incrementMetric(env, 'zapier_failed');
			return;
		}

		// Retry loop with exponential backoff
		for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
			try {
				logger.debug('Attempting webhook delivery', {
					correlation_id: correlationId,
					event_id: eventId,
					webhook_id: webhook.id,
					attempt,
					max_retries: this.MAX_RETRIES,
				});

				// Prepare request headers
				const headers: Record<string, string> = {
					'Content-Type': 'application/json',
					'User-Agent': 'TriggersAPI-Zapier/1.0',
					'X-Event-ID': eventId,
					'X-Correlation-ID': correlationId,
					'X-Attempt': attempt.toString(),
				};

				// Add HMAC signature if secret is configured (Epic 8.4)
				if (env.ZAPIER_SIGNING_SECRET) {
					headers['X-Zapier-Signature'] = await SignatureService.createSignatureHeader(
						event,
						env.ZAPIER_SIGNING_SECRET
					);
					logger.debug('Added signature to webhook delivery', {
						correlation_id: correlationId,
						event_id: eventId,
						webhook_id: webhook.id,
					});
				}

				// Make HTTP POST request to webhook URL
				const response = await fetch(webhook.url, {
					method: 'POST',
					headers,
					body: JSON.stringify(event),
					signal: AbortSignal.timeout(this.TIMEOUT_MS),
				});

				lastStatusCode = response.status;

				// Check for success (2xx status codes)
				if (response.status >= 200 && response.status < 300) {
					logger.info('Webhook delivery successful', {
						correlation_id: correlationId,
						event_id: eventId,
						webhook_id: webhook.id,
						status_code: response.status,
						attempt,
					});

					// Update webhook status to active and record success
					await env.DB.prepare(
						`UPDATE zapier_webhooks
             SET status = 'active',
                 last_tested_at = ?,
                 last_error = NULL
             WHERE id = ?`
					)
						.bind(new Date().toISOString(), webhook.id)
						.run();

					// Increment success metric
					await this.incrementMetric(env, 'zapier_delivered');

					// Success - exit retry loop
					return;
				}

				// Handle rate limiting (429 Too Many Requests)
				if (response.status === 429) {
					const retryAfter = response.headers.get('Retry-After');
					lastError = `Rate limited (429)${retryAfter ? `, retry after ${retryAfter}s` : ''}`;

					logger.warn('Webhook rate limited', {
						correlation_id: correlationId,
						event_id: eventId,
						webhook_id: webhook.id,
						retry_after: retryAfter,
						attempt,
					});
				} else {
					lastError = `HTTP ${response.status}`;
					logger.warn('Webhook delivery failed with non-2xx response', {
						correlation_id: correlationId,
						event_id: eventId,
						webhook_id: webhook.id,
						status_code: response.status,
						attempt,
					});
				}

				// Retry if we have attempts left
				if (attempt < this.MAX_RETRIES) {
					const delay = this.BACKOFF_DELAYS[attempt - 1];
					logger.info('Retrying webhook delivery', {
						correlation_id: correlationId,
						event_id: eventId,
						webhook_id: webhook.id,
						delay_ms: delay,
						next_attempt: attempt + 1,
					});
					await this.sleep(delay);
				}
			} catch (error) {
				// Network error, timeout, or other fetch failure
				lastError = error instanceof Error ? error.message : String(error);

				logger.warn('Webhook delivery attempt failed', {
					correlation_id: correlationId,
					event_id: eventId,
					webhook_id: webhook.id,
					error: lastError,
					attempt,
				});

				// Retry if we have attempts left
				if (attempt < this.MAX_RETRIES) {
					const delay = this.BACKOFF_DELAYS[attempt - 1];
					logger.info('Retrying webhook delivery after error', {
						correlation_id: correlationId,
						event_id: eventId,
						webhook_id: webhook.id,
						delay_ms: delay,
						next_attempt: attempt + 1,
					});
					await this.sleep(delay);
				}
			}
		}

		// All retries exhausted - webhook is failing
		logger.error('Webhook delivery failed after all retries', {
			correlation_id: correlationId,
			event_id: eventId,
			webhook_id: webhook.id,
			webhook_url: webhook.url,
			last_error: lastError,
			last_status_code: lastStatusCode,
			total_attempts: this.MAX_RETRIES,
		});

		// Update webhook status to 'failing' and increment retry counter
		await env.DB.prepare(
			`UPDATE zapier_webhooks
       SET status = 'failing',
           last_error = ?,
           retry_count = retry_count + 1
       WHERE id = ?`
		)
			.bind(lastError, webhook.id)
			.run();

		// Increment failure metric
		await this.incrementMetric(env, 'zapier_failed');

		// Log to Dead Letter Queue for monitoring
		await this.logToDLQ(env, {
			webhook_id: webhook.id,
			webhook_url: webhook.url,
			event_id: eventId,
			correlation_id: correlationId,
			error: lastError,
			status_code: lastStatusCode,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Increment a metric counter in KV
	 * Uses retry logic to handle concurrent updates
	 *
	 * @param env - Cloudflare environment bindings
	 * @param key - Metric key name
	 */
	private static async incrementMetric(env: Env, key: string): Promise<void> {
		const maxRetries = 5;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				// Read current value
				const current = (await env.METRICS_KV.get(key, 'json')) as number | null;
				const newValue = (current || 0) + 1;

				// Write new value
				await env.METRICS_KV.put(key, JSON.stringify(newValue));

				// Verify write succeeded by reading back
				const verified = (await env.METRICS_KV.get(key, 'json')) as number | null;
				if (verified === newValue) {
					return; // Success
				}

				// Value changed between write and read - retry
				if (attempt < maxRetries - 1) {
					await this.sleep(10 * (attempt + 1)); // Small backoff
					continue;
				}
			} catch (error) {
				logger.error('Failed to update metric', {
					metric_key: key,
					attempt: attempt + 1,
					error: error instanceof Error ? error.message : String(error),
				});

				if (attempt < maxRetries - 1) {
					await this.sleep(10 * (attempt + 1));
					continue;
				}
			}
		}

		// All retries failed - log but don't throw
		logger.warn('Metric increment failed after all retries', { metric_key: key });
	}

	/**
	 * Log failed delivery to Dead Letter Queue
	 *
	 * @param env - Cloudflare environment bindings
	 * @param data - DLQ entry data
	 */
	private static async logToDLQ(env: Env, data: Record<string, unknown>): Promise<void> {
		try {
			const dlqKey = `dlq-${data.webhook_id}-${data.event_id}`;
			await env.METRICS_KV.put(dlqKey, JSON.stringify(data), {
				expirationTtl: 86400 * 7, // 7 days
			});

			logger.info('Failed delivery logged to DLQ', {
				dlq_key: dlqKey,
				webhook_id: data.webhook_id,
				event_id: data.event_id,
			});
		} catch (error) {
			logger.error('Failed to log to DLQ', {
				error: error instanceof Error ? error.message : String(error),
			});
			// Don't throw - DLQ logging is best-effort
		}
	}

	/**
	 * Sleep for specified milliseconds
	 *
	 * @param ms - Milliseconds to sleep
	 */
	private static sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Get delivery metrics
	 *
	 * @param env - Cloudflare environment bindings
	 * @returns Delivery metrics (total delivered, failed, success rate)
	 */
	static async getMetrics(env: Env): Promise<{
		total_delivered: number;
		total_failed: number;
		success_rate: string;
	}> {
		try {
			const delivered = ((await env.METRICS_KV.get('zapier_delivered', 'json')) as number) || 0;
			const failed = ((await env.METRICS_KV.get('zapier_failed', 'json')) as number) || 0;
			const total = delivered + failed;
			const successRate = total > 0 ? ((delivered / total) * 100).toFixed(2) : '0.00';

			return {
				total_delivered: delivered,
				total_failed: failed,
				success_rate: `${successRate}%`,
			};
		} catch (error) {
			logger.error('Failed to fetch delivery metrics', {
				error: error instanceof Error ? error.message : String(error),
			});

			return {
				total_delivered: 0,
				total_failed: 0,
				success_rate: '0.00%',
			};
		}
	}
}
