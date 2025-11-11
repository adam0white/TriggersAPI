/**
 * Queue Message Validation Module
 *
 * Validates messages received from Cloudflare Queue consumer
 * - Ensures required fields are present (event_id, payload)
 * - Type checks for field data types
 * - Returns typed QueueMessage interface
 *
 * Throws validation errors for malformed messages to trigger queue retry
 */

export interface QueueMessage {
	event_id: string;
	payload: Record<string, any>;
	metadata?: Record<string, any>;
	timestamp: string;
	correlation_id?: string;
}

/**
 * Validate and type-cast unknown queue message body
 *
 * @param body - Unknown message body from queue
 * @returns Validated QueueMessage with correct types
 * @throws Error if message is malformed or missing required fields
 */
export function validateQueueMessage(body: unknown): QueueMessage {
	// Type assertion for initial check
	const msg = body as any;

	// Validate event_id (required string)
	if (!msg.event_id || typeof msg.event_id !== 'string') {
		throw new Error('Invalid or missing event_id: must be a non-empty string');
	}

	// Validate payload (required object)
	if (!msg.payload || typeof msg.payload !== 'object' || Array.isArray(msg.payload)) {
		throw new Error('Invalid or missing payload: must be a non-null object');
	}

	// Validate optional metadata (if present, must be object)
	if (msg.metadata !== undefined) {
		if (typeof msg.metadata !== 'object' || Array.isArray(msg.metadata) || msg.metadata === null) {
			throw new Error('Invalid metadata: must be an object if provided');
		}
	}

	// Validate timestamp (required string, fallback to current time if missing)
	const timestamp = msg.timestamp && typeof msg.timestamp === 'string' ? msg.timestamp : new Date().toISOString();

	// Validate optional correlation_id (if present, must be string)
	if (msg.correlation_id !== undefined && typeof msg.correlation_id !== 'string') {
		throw new Error('Invalid correlation_id: must be a string if provided');
	}

	// Return validated message with correct types
	return {
		event_id: msg.event_id,
		payload: msg.payload,
		metadata: msg.metadata,
		timestamp,
		correlation_id: msg.correlation_id,
	};
}
