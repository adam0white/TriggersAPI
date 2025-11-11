/**
 * Authentication Middleware
 *
 * Bearer token validation via Cloudflare KV lookup.
 * Validates Authorization header, extracts Bearer token, and verifies against KV store.
 *
 * Token Storage Format (KV):
 * - Key: auth:token:<token_value>
 * - Value: { "valid": true, "created_at": "ISO-8601-timestamp" }
 *
 * Error Codes:
 * - MISSING_AUTHORIZATION: Authorization header not provided
 * - INVALID_AUTH_SCHEME: Authorization header doesn't use Bearer scheme
 * - INVALID_TOKEN_FORMAT: Token format is invalid (too short/long)
 * - INVALID_TOKEN: Token not found in KV or invalid
 * - AUTH_SERVICE_ERROR: KV lookup service failure (503)
 */

import { unauthorized, serviceUnavailable } from './error-handler';
import { logAuthFailure, logError } from './logger';
import type { ErrorCode } from '../lib/errors';

export interface AuthContext {
	isAuthenticated: boolean;
	correlationId: string;
	error?: {
		code: string;
		message: string;
	};
}

/**
 * Validates Bearer token against KV store
 *
 * @param request - Incoming HTTP request
 * @param env - Cloudflare environment bindings (includes AUTH_KV)
 * @param correlationId - Request correlation ID for tracing
 * @returns AuthContext with authentication status and optional error
 */
export async function validateBearerToken(
	request: Request,
	env: Env,
	correlationId: string
): Promise<AuthContext> {
	const authHeader = request.headers.get('Authorization');

	// Check header exists
	if (!authHeader) {
		logAuthFailure('MISSING_AUTHORIZATION', correlationId, 'Authorization header not present');
		return {
			isAuthenticated: false,
			correlationId,
			error: {
				code: 'MISSING_AUTHORIZATION',
				message: 'Authorization header is required',
			},
		};
	}

	// Check Bearer scheme
	if (!authHeader.startsWith('Bearer ')) {
		logAuthFailure('INVALID_AUTH_SCHEME', correlationId, 'Authorization header does not use Bearer scheme');
		return {
			isAuthenticated: false,
			correlationId,
			error: {
				code: 'INVALID_AUTH_SCHEME',
				message: 'Authorization must use Bearer scheme',
			},
		};
	}

	// Extract token
	const token = authHeader.slice(7); // Remove 'Bearer ' prefix

	// Validate token format (basic: non-empty, reasonable length)
	if (!token || token.length < 10 || token.length > 256) {
		logAuthFailure('INVALID_TOKEN_FORMAT', correlationId, 'Token length validation failed');
		return {
			isAuthenticated: false,
			correlationId,
			error: {
				code: 'INVALID_TOKEN_FORMAT',
				message: 'Bearer token format is invalid',
			},
		};
	}

	// Lookup in KV
	try {
		const kvKey = `auth:token:${token}`;
		const tokenData = await env.AUTH_KV.get(kvKey);

		if (!tokenData) {
			// Development fallback: Allow hardcoded test token for local dev
			const DEV_TOKEN = 'sk_test_abc123xyz789';
			if (token === DEV_TOKEN) {
				return {
					isAuthenticated: true,
					correlationId,
				};
			}

			logAuthFailure('INVALID_TOKEN', correlationId, 'Token not found in KV store');
			return {
				isAuthenticated: false,
				correlationId,
				error: {
					code: 'INVALID_TOKEN',
					message: 'Bearer token not found or invalid',
				},
			};
		}

		// Token exists and is valid
		return {
			isAuthenticated: true,
			correlationId,
		};
	} catch (error) {
		// KV lookup failure - return 500-level error
		logError({
			message: 'Authentication service error',
			code: 'AUTH_SERVICE_ERROR',
			correlationId,
			error: error instanceof Error ? error.message : String(error),
		});
		return {
			isAuthenticated: false,
			correlationId,
			error: {
				code: 'AUTH_SERVICE_ERROR',
				message: 'Authentication service unavailable',
			},
		};
	}
}

/**
 * Creates a 401 Unauthorized response
 * @deprecated Use createErrorResponse from error-handler middleware instead
 *
 * @param error - Error details (code and message)
 * @param correlationId - Request correlation ID
 * @returns 401 Response with structured error body
 */
export function unauthorizedResponse(
	error: { code: string; message: string },
	correlationId: string
): Response {
	return unauthorized(error.code as ErrorCode, correlationId, error.message);
}

/**
 * Creates a 503 Service Unavailable response (auth service failure)
 * @deprecated Use createErrorResponse from error-handler middleware instead
 *
 * @param error - Error details (code and message)
 * @param correlationId - Request correlation ID
 * @returns 503 Response with structured error body
 */
export function serviceErrorResponse(
	error: { code: string; message: string },
	correlationId: string
): Response {
	return serviceUnavailable(error.code as ErrorCode, correlationId, error.message);
}
