/**
 * Zapier Event Schema Validation
 * Epic 8.4: Security & Validation
 *
 * JSON Schema validation for event payloads sent to Zapier webhooks
 * - Validates event structure and field types
 * - Ensures required fields are present
 * - Provides detailed field-level validation errors
 */

/**
 * JSON Schema for Zapier event payloads
 */
export const ZAPIER_EVENT_SCHEMA = {
	$schema: 'http://json-schema.org/draft-07/schema#',
	type: 'object',
	required: ['event_id', 'event_type', 'timestamp', 'payload', 'metadata', 'created_at'],
	properties: {
		event_id: {
			type: 'string',
			minLength: 1,
			maxLength: 255,
			pattern: '^[a-zA-Z0-9_-]+$',
			description: 'Unique event identifier',
		},
		event_type: {
			type: 'string',
			minLength: 1,
			maxLength: 255,
			pattern: '^[a-zA-Z0-9_]+$',
			description: 'Event type/category',
		},
		timestamp: {
			type: 'string',
			format: 'date-time',
			description: 'Event timestamp (ISO-8601)',
		},
		payload: {
			type: 'object',
			description: 'Event payload (arbitrary JSON)',
			maxProperties: 100,
		},
		metadata: {
			type: 'object',
			description: 'Event metadata (source, correlation ID, etc)',
			properties: {
				correlation_id: { type: 'string' },
				source_ip: { type: 'string' },
				user_agent: { type: 'string' },
			},
		},
		created_at: {
			type: 'string',
			format: 'date-time',
			description: 'Event creation timestamp',
		},
	},
	additionalProperties: false,
};

/**
 * Validation error details
 */
export interface ValidationError {
	field: string;
	message: string;
	constraint: string;
}

/**
 * Validate event against Zapier event schema
 *
 * Performs comprehensive validation of event structure:
 * - Required fields presence
 * - Field types and formats
 * - String length constraints
 * - Pattern matching for event_id and event_type
 * - ISO-8601 timestamp validation
 *
 * @param event - Event data to validate
 * @returns Validation result with detailed errors
 */
export function validateZapierEvent(event: unknown): {
	valid: boolean;
	errors: ValidationError[];
} {
	const errors: ValidationError[] = [];

	// Check if event is an object
	if (typeof event !== 'object' || event === null) {
		return {
			valid: false,
			errors: [{ field: '$', message: 'Event must be an object', constraint: 'type' }],
		};
	}

	const obj = event as Record<string, unknown>;

	// Check required fields
	const required = ['event_id', 'event_type', 'timestamp', 'payload', 'metadata', 'created_at'];
	for (const field of required) {
		if (!(field in obj)) {
			errors.push({
				field,
				message: `Missing required field: ${field}`,
				constraint: 'required',
			});
		}
	}

	// Validate event_id
	if (obj.event_id !== undefined) {
		if (typeof obj.event_id !== 'string') {
			errors.push({
				field: 'event_id',
				message: 'event_id must be a string',
				constraint: 'type',
			});
		} else if (obj.event_id.length === 0 || obj.event_id.length > 255) {
			errors.push({
				field: 'event_id',
				message: 'event_id must be 1-255 characters',
				constraint: 'length',
			});
		} else if (!/^[a-zA-Z0-9_-]+$/.test(obj.event_id)) {
			errors.push({
				field: 'event_id',
				message: 'event_id must only contain alphanumeric characters, underscores, and hyphens',
				constraint: 'pattern',
			});
		}
	}

	// Validate event_type
	if (obj.event_type !== undefined) {
		if (typeof obj.event_type !== 'string') {
			errors.push({
				field: 'event_type',
				message: 'event_type must be a string',
				constraint: 'type',
			});
		} else if (obj.event_type.length === 0 || obj.event_type.length > 255) {
			errors.push({
				field: 'event_type',
				message: 'event_type must be 1-255 characters',
				constraint: 'length',
			});
		} else if (!/^[a-zA-Z0-9_]+$/.test(obj.event_type)) {
			errors.push({
				field: 'event_type',
				message: 'event_type must only contain alphanumeric characters and underscores',
				constraint: 'pattern',
			});
		}
	}

	// Validate timestamp
	if (obj.timestamp !== undefined) {
		if (typeof obj.timestamp !== 'string') {
			errors.push({
				field: 'timestamp',
				message: 'timestamp must be a string',
				constraint: 'type',
			});
		} else if (!isValidISO8601(obj.timestamp)) {
			errors.push({
				field: 'timestamp',
				message: 'timestamp must be valid ISO-8601 format',
				constraint: 'format',
			});
		}
	}

	// Validate payload
	if (obj.payload !== undefined) {
		if (typeof obj.payload !== 'object' || obj.payload === null) {
			errors.push({
				field: 'payload',
				message: 'payload must be an object',
				constraint: 'type',
			});
		} else if (Object.keys(obj.payload).length > 100) {
			errors.push({
				field: 'payload',
				message: 'payload must have at most 100 properties',
				constraint: 'maxProperties',
			});
		}
	}

	// Validate metadata
	if (obj.metadata !== undefined) {
		if (typeof obj.metadata !== 'object' || obj.metadata === null) {
			errors.push({
				field: 'metadata',
				message: 'metadata must be an object',
				constraint: 'type',
			});
		}
	}

	// Validate created_at
	if (obj.created_at !== undefined) {
		if (typeof obj.created_at !== 'string') {
			errors.push({
				field: 'created_at',
				message: 'created_at must be a string',
				constraint: 'type',
			});
		} else if (!isValidISO8601(obj.created_at)) {
			errors.push({
				field: 'created_at',
				message: 'created_at must be valid ISO-8601 format',
				constraint: 'format',
			});
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Check if string is valid ISO-8601 date
 *
 * @param date - Date string to validate
 * @returns True if valid ISO-8601 format
 */
function isValidISO8601(date: string): boolean {
	try {
		const d = new Date(date);
		return !isNaN(d.getTime()) && d.toISOString() === date;
	} catch {
		return false;
	}
}
