/**
 * Error Codes and Messages
 *
 * Centralized error code definitions for consistent error responses across the API.
 * Each error code has a machine-readable code and a human-readable message.
 *
 * Error Categories:
 * - Validation Errors (400): JSON/Payload validation failures
 * - Authentication Errors (401): Missing/invalid authorization
 * - Service Errors (503): External service failures
 * - Processing Errors (500): Internal server errors
 */

export const ErrorCodes = {
	// JSON/Payload errors (400)
	INVALID_JSON: 'Request body must be valid JSON',
	INVALID_PAYLOAD: 'Request body must contain payload field as JSON object',
	PAYLOAD_TOO_LARGE: 'Request body exceeds maximum size of 1MB',

	// Field-specific errors (400)
	MISSING_PAYLOAD_FIELD: "Required field 'payload' is missing",
	INVALID_METADATA_TYPE: "'metadata' field must be a JSON object",
	INVALID_PAYLOAD_TYPE: "'payload' field must be a JSON object",

	// Authentication errors (401)
	MISSING_AUTHORIZATION: 'Authorization header is required',
	INVALID_AUTH_SCHEME: 'Authorization must use Bearer scheme',
	INVALID_TOKEN_FORMAT: 'Bearer token format is invalid',
	INVALID_TOKEN: 'Bearer token not found or invalid',

	// Service errors (503)
	AUTH_SERVICE_ERROR: 'Authentication service unavailable',
	QUEUE_SERVICE_ERROR: 'Queue service temporarily unavailable',
	SERVICE_UNAVAILABLE: 'Service temporarily unavailable',

	// Processing errors (500)
	INTERNAL_ERROR: 'An unexpected error occurred',
	PROCESSING_ERROR: 'Event processing failed',
	DATABASE_ERROR: 'Database service error',
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

/**
 * Get error message by code
 * @param code - Machine-readable error code
 * @returns Human-readable error message
 */
export function getErrorMessage(code: ErrorCode): string {
	return ErrorCodes[code];
}

/**
 * Check if an error code exists
 * @param code - Error code to check
 * @returns True if error code is defined
 */
export function isValidErrorCode(code: string): code is ErrorCode {
	return code in ErrorCodes;
}
