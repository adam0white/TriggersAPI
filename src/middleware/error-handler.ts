/**
 * Error Handler Middleware
 *
 * Centralized error response creation and handling for consistent error responses.
 * All error responses include: code, message, timestamp, correlation_id.
 *
 * Usage:
 * - createErrorResponse(): Create structured error response with specific status/code
 * - handleError(): Handle unexpected errors with fallback to 500
 * - Helper functions: badRequest(), unauthorized(), payloadTooLarge(), serviceUnavailable(), internalError()
 */

import { ErrorCodes, type ErrorCode } from '../lib/errors';
import { logError, logWarning } from './logger';

export interface ErrorContext {
	statusCode: number;
	code: string;
	message: string;
	correlationId: string;
}

/**
 * Create a structured error response
 *
 * All error responses follow this structure:
 * {
 *   "error": {
 *     "code": "MACHINE_READABLE_CODE",
 *     "message": "Human-readable error description",
 *     "timestamp": "2025-11-10T12:34:56.789Z",
 *     "correlation_id": "uuid-v4-string"
 *   }
 * }
 *
 * @param context - Error context with status, code, message, and correlation ID
 * @returns Response with structured error body and headers
 */
export function createErrorResponse(context: ErrorContext): Response {
	const { statusCode, code, message, correlationId } = context;

	const timestamp = new Date().toISOString();
	const responseBody = {
		error: {
			code,
			message,
			timestamp,
			correlation_id: correlationId,
		},
	};

	// Log error or warning based on status code
	if (statusCode >= 500) {
		logError({
			message: 'Server error response',
			code,
			correlationId,
			statusCode,
		});
	} else if (statusCode === 401) {
		logWarning({
			message: 'Unauthorized request',
			code,
			correlationId,
		});
	} else {
		logError({
			message: 'Client error response',
			code,
			correlationId,
			statusCode,
		});
	}

	return new Response(JSON.stringify(responseBody), {
		status: statusCode,
		headers: {
			'Content-Type': 'application/json',
			'X-Correlation-ID': correlationId,
		},
	});
}

/**
 * Handle unexpected errors with fallback to 500 Internal Error
 *
 * Logs the error with full details (stack trace) and returns a generic error response.
 * Never exposes internal error details to the client.
 *
 * @param error - Unknown error from try-catch block
 * @param correlationId - Request correlation ID
 * @param defaultMessage - Optional custom error message (defaults to INTERNAL_ERROR)
 * @returns 500 Response with structured error body
 */
export function handleError(
	error: unknown,
	correlationId: string,
	defaultMessage = ErrorCodes.INTERNAL_ERROR
): Response {
	// Log the full error with stack trace for debugging
	logError({
		message: 'Unhandled error occurred',
		error: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
		correlationId,
	});

	// Return generic 500 error response
	return createErrorResponse({
		statusCode: 500,
		code: 'INTERNAL_ERROR',
		message: defaultMessage,
		correlationId,
	});
}

// ============================================================================
// Helper Functions for Common HTTP Errors
// ============================================================================

/**
 * Create 400 Bad Request error response
 * @param code - Error code (must be valid ErrorCode)
 * @param message - Optional custom message (defaults to code's message)
 * @param correlationId - Request correlation ID
 * @returns 400 Response
 */
export function badRequest(code: ErrorCode, correlationId: string, message?: string): Response {
	return createErrorResponse({
		statusCode: 400,
		code,
		message: message || ErrorCodes[code],
		correlationId,
	});
}

/**
 * Create 401 Unauthorized error response
 * @param code - Error code (must be valid ErrorCode)
 * @param message - Optional custom message (defaults to code's message)
 * @param correlationId - Request correlation ID
 * @returns 401 Response
 */
export function unauthorized(code: ErrorCode, correlationId: string, message?: string): Response {
	return createErrorResponse({
		statusCode: 401,
		code,
		message: message || ErrorCodes[code],
		correlationId,
	});
}

/**
 * Create 413 Payload Too Large error response
 * @param correlationId - Request correlation ID
 * @param message - Optional custom message
 * @returns 413 Response
 */
export function payloadTooLarge(correlationId: string, message?: string): Response {
	return createErrorResponse({
		statusCode: 413,
		code: 'PAYLOAD_TOO_LARGE',
		message: message || ErrorCodes.PAYLOAD_TOO_LARGE,
		correlationId,
	});
}

/**
 * Create 500 Internal Server Error response
 * @param correlationId - Request correlation ID
 * @param message - Optional custom message (defaults to INTERNAL_ERROR)
 * @returns 500 Response
 */
export function internalError(correlationId: string, message?: string): Response {
	return createErrorResponse({
		statusCode: 500,
		code: 'INTERNAL_ERROR',
		message: message || ErrorCodes.INTERNAL_ERROR,
		correlationId,
	});
}

/**
 * Create 503 Service Unavailable error response
 * @param code - Error code (must be valid ErrorCode)
 * @param correlationId - Request correlation ID
 * @param message - Optional custom message (defaults to code's message)
 * @returns 503 Response
 */
export function serviceUnavailable(code: ErrorCode, correlationId: string, message?: string): Response {
	return createErrorResponse({
		statusCode: 503,
		code,
		message: message || ErrorCodes[code],
		correlationId,
	});
}
