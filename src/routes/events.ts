/**
 * Events Route Handler
 *
 * Handles POST /events endpoint for event ingestion.
 * - Validates request payload structure
 * - Generates unique event IDs
 * - Sends events to Cloudflare Queue for async processing
 * - Returns structured responses
 * - Enforces 1MB payload size limit
 *
 * Flow: Validation → Auth → Queue Send → 200 Response
 */

import { validateEventRequest } from '../lib/validation';
import { sendEventToQueue } from '../lib/queue';
import { badRequest, payloadTooLarge, serviceUnavailable, internalError } from '../middleware/error-handler';
import { logInfo } from '../middleware/logger';

const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

interface EventPayload {
	payload: Record<string, any>;
	metadata?: Record<string, any>;
}

/**
 * POST /events handler
 *
 * @param request - Incoming HTTP request
 * @param env - Cloudflare environment bindings
 * @param correlationId - Request correlation ID for tracing
 * @returns JSON response (200 success, 400/413 error)
 */
export async function handlePostEvents(request: Request, env: Env, correlationId: string): Promise<Response> {
	// Debug flag support - force validation error for testing
	if (new URL(request.url).searchParams.get('debug') === 'validation_error') {
		return badRequest('INVALID_PAYLOAD', correlationId, 'Debug: Forced validation error');
	}

	// Check content-length header for early rejection
	const contentLength = request.headers.get('content-length');
	if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
		return payloadTooLarge(correlationId);
	}

	// Parse JSON
	let body: unknown;
	try {
		body = await request.json();
	} catch (error) {
		return badRequest('INVALID_JSON', correlationId);
	}

	// Validate structure
	const validation = validateEventRequest(body);
	if (!validation.valid) {
		return badRequest(validation.error.code as any, correlationId, validation.error.message);
	}

	const { payload, metadata } = validation.data;

	// Generate event ID
	const eventId = crypto.randomUUID();

	// Check for debug flags
	const debugFlag = new URL(request.url).searchParams.get('debug');

	// Debug flag: ?debug=dlq_routing - force event to Dead Letter Queue
	if (debugFlag === 'dlq_routing') {
		// Mark payload for DLQ routing (consumer will recognize this)
		const dlqPayload = { ...payload, _force_dlq: true };
		const queueResult = await sendEventToQueue(env, eventId, dlqPayload, metadata, correlationId);

		if (!queueResult.success) {
			return serviceUnavailable('QUEUE_SERVICE_ERROR', correlationId);
		}

		logInfo('Event queued with DLQ flag', { eventId, correlationId, debug: 'dlq_routing' });

		const timestamp = new Date().toISOString();
		return new Response(
			JSON.stringify({
				data: {
					event_id: eventId,
					status: 'accepted',
					timestamp,
					debug_note: 'Event forced to dead letter queue',
				},
				timestamp,
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'X-Correlation-ID': correlationId,
				},
			},
		);
	}

	// Send to queue for async processing
	const queueResult = await sendEventToQueue(env, eventId, payload, metadata, correlationId);

	if (!queueResult.success) {
		// If queue is full or unavailable, return 503
		return serviceUnavailable('QUEUE_SERVICE_ERROR', correlationId);
	}

	// Debug flag: ?debug=processing_error - return 500 after successful queuing
	if (debugFlag === 'processing_error') {
		// Event was queued successfully, but we return error for testing
		logInfo('Debug: Forcing processing error after successful queue', { eventId, correlationId });
		return internalError(correlationId, 'Debug: Forced processing error for testing');
	}

	// Queue send succeeded, return 200 acceptance
	logInfo('Event queued successfully', { eventId, correlationId });

	const timestamp = new Date().toISOString();
	return new Response(
		JSON.stringify({
			data: {
				event_id: eventId,
				status: 'accepted',
				timestamp,
			},
			timestamp,
		}),
		{
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'X-Correlation-ID': correlationId,
			},
		},
	);
}
