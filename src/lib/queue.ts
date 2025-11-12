/**
 * Queue Module
 *
 * Handles sending events to Cloudflare Queue for asynchronous processing.
 * - Sends validated events to EVENT_QUEUE
 * - Includes correlation_id for tracing
 * - Structured logging for all queue operations
 * - Error handling for queue failures (503 response)
 */

export interface QueuedEvent {
	event_id: string;
	payload: Record<string, any>;
	metadata?: Record<string, any>;
	timestamp: string;
}

/**
 * Send event to Cloudflare Queue for async processing
 *
 * @param env - Cloudflare environment bindings (includes EVENT_QUEUE)
 * @param eventId - UUID of the event
 * @param payload - Event payload data
 * @param metadata - Optional event metadata
 * @param correlationId - Request correlation ID for tracing
 * @returns Promise with success status and optional error message
 */
export async function sendEventToQueue(
	env: Env,
	eventId: string,
	payload: Record<string, any>,
	metadata: Record<string, any> | undefined,
	correlationId: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		const queuedEvent: QueuedEvent = {
			event_id: eventId,
			payload,
			metadata,
			timestamp: new Date().toISOString(),
		};

		// Send to queue - this returns immediately, message is persisted
		await env.EVENT_QUEUE.send(queuedEvent);

		console.log(
			JSON.stringify({
				level: 'info',
				message: 'Event queued successfully',
				event_id: eventId,
				correlation_id: correlationId,
				timestamp: new Date().toISOString(),
			}),
		);

		return { success: true };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(
			JSON.stringify({
				level: 'error',
				message: 'Failed to queue event',
				event_id: eventId,
				error: errorMessage,
				correlation_id: correlationId,
				timestamp: new Date().toISOString(),
			}),
		);

		return {
			success: false,
			error: errorMessage,
		};
	}
}
