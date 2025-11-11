/**
 * Request Validation Module
 *
 * Validates incoming event requests according to API specification.
 * - payload: REQUIRED, must be JSON object
 * - metadata: OPTIONAL, if present must be JSON object
 *
 * Used by: POST /events endpoint
 */

interface EventRequest {
	payload: Record<string, any>;
	metadata?: Record<string, any>;
}

interface ValidationError {
	code: string;
	message: string;
}

/**
 * Validates event request body structure
 *
 * @param body - Unknown input from request.json()
 * @returns Success with validated data OR failure with error details
 */
export function validateEventRequest(
	body: unknown
): { valid: true; data: EventRequest } | { valid: false; error: ValidationError } {
	// Check if body is object
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return {
			valid: false,
			error: {
				code: 'INVALID_PAYLOAD',
				message: 'Request body must be a JSON object',
			},
		};
	}

	const obj = body as Record<string, unknown>;

	// Check payload field exists
	if (!('payload' in obj)) {
		return {
			valid: false,
			error: {
				code: 'INVALID_PAYLOAD',
				message: "Request body must contain 'payload' field",
			},
		};
	}

	// Check payload is object
	if (typeof obj.payload !== 'object' || obj.payload === null || Array.isArray(obj.payload)) {
		return {
			valid: false,
			error: {
				code: 'INVALID_PAYLOAD',
				message: "'payload' field must be a JSON object",
			},
		};
	}

	// Check metadata if present
	if ('metadata' in obj && obj.metadata !== undefined) {
		if (typeof obj.metadata !== 'object' || obj.metadata === null || Array.isArray(obj.metadata)) {
			return {
				valid: false,
				error: {
					code: 'INVALID_PAYLOAD',
					message: "'metadata' field must be a JSON object",
				},
			};
		}
	}

	return {
		valid: true,
		data: {
			payload: obj.payload as Record<string, any>,
			metadata: obj.metadata as Record<string, any> | undefined,
		},
	};
}
