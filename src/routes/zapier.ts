/**
 * Zapier Webhook Subscription Endpoints
 * Epic 8.2: Webhook Subscription Management
 * Epic 8.4: Security & Validation
 *
 * Implements the Zapier REST Hook protocol for webhook lifecycle:
 * - POST /zapier/hook - Subscribe to webhooks
 * - GET /zapier/hook - Test webhook with sample data
 * - DELETE /zapier/hook - Unsubscribe from webhooks
 *
 * Security features (Epic 8.4):
 * - HMAC-SHA256 signature verification
 * - Rate limiting (100 subscriptions/hour, 60 samples/hour)
 * - Payload schema validation
 * - Security headers on all responses
 *
 * See docs/zapier-handshake-protocol.md for full protocol specification
 */

import {
	ZapierSubscribeRequest,
	ZapierSubscribeResponse,
	ZapierTestResponse,
	ZapierUnsubscribeRequest,
	ZapierUnsubscribeResponse,
} from '../types/api';
import { logger } from '../lib/logger';
import { SignatureService } from '../lib/signature-service';
import { validateZapierEvent } from '../lib/zapier-schema';
import { RateLimiter } from '../lib/rate-limiter';

/**
 * POST /zapier/hook
 * Subscribe a new webhook URL to receive event notifications
 *
 * Request body:
 *   { "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/" }
 *
 * Security:
 *   - Rate limited to 100 requests per IP per hour
 *   - HMAC-SHA256 signature verification (production only)
 *   - Content-Type must be application/json
 *   - Max request body size: 10MB
 *
 * Response:
 *   201 Created - Webhook subscription created
 *   400 Bad Request - Invalid URL format, missing field, or validation error
 *   401 Unauthorized - Invalid or missing signature
 *   409 Conflict - Webhook already subscribed
 *   413 Payload Too Large - Request body exceeds 10MB
 *   429 Too Many Requests - Rate limit exceeded
 *   500 Internal Server Error - Database error
 */
export async function handleZapierSubscribe(request: Request, env: Env): Promise<Response> {
	const correlationId = crypto.randomUUID();

	try {
		// Get client IP for rate limiting
		const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';

		// Rate limiting check
		const rateLimit = RateLimiter.checkSubscription(clientIp, correlationId);
		if (!rateLimit.allowed) {
			logger.warn('Subscription rate limit exceeded', {
				correlationId,
				client_ip: clientIp,
				retry_after: rateLimit.retryAfter,
			});

			return jsonResponse(
				{
					status: 'error',
					message: 'Rate limit exceeded. Maximum 100 subscriptions per hour.',
				},
				429,
				correlationId,
				{
					'Retry-After': rateLimit.retryAfter?.toString() || '3600',
					'X-RateLimit-Limit': rateLimit.limit.toString(),
					'X-RateLimit-Remaining': '0',
					'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
				}
			);
		}

		// Content-Type validation
		const contentType = request.headers.get('content-type');
		if (!contentType?.includes('application/json')) {
			logger.warn('Invalid Content-Type', { correlationId, content_type: contentType });
			return jsonResponse(
				{
					status: 'error',
					message: 'Content-Type must be application/json',
					validation_error: {
						field: 'Content-Type',
						constraint: 'format',
						expected: 'application/json',
					},
				},
				400,
				correlationId
			);
		}

		// Read raw request body for signature verification and size check
		const bodyText = await request.text();

		// Size limit check (10MB)
		const bodySize = new Blob([bodyText]).size;
		if (bodySize > 10 * 1024 * 1024) {
			logger.warn('Request body too large', { correlationId, size_bytes: bodySize });
			return jsonResponse(
				{
					status: 'error',
					message: 'Request body too large (max 10MB)',
				},
				413,
				correlationId
			);
		}

		// Signature verification (skip for localhost in dev)
		const isLocalhost = request.headers.get('host')?.includes('localhost');
		if (!isLocalhost && env.ZAPIER_SIGNING_SECRET) {
			const signatureHeader = request.headers.get('x-zapier-signature');

			if (!signatureHeader) {
				logger.warn('Missing signature header', { correlationId, client_ip: clientIp });
				return jsonResponse(
					{
						status: 'error',
						message: 'Missing X-Zapier-Signature header',
					},
					401,
					correlationId
				);
			}

			// Parse signature header
			const parsed = SignatureService.parseSignatureHeader(signatureHeader);
			if (!parsed) {
				logger.warn('Invalid signature format', {
					correlationId,
					client_ip: clientIp,
					signature: signatureHeader,
				});
				return jsonResponse(
					{
						status: 'error',
						message: 'Invalid signature format. Expected: sha256=...',
					},
					401,
					correlationId
				);
			}

			// Verify signature
			const isValid = await SignatureService.verifySignature(
				bodyText,
				parsed.signature,
				env.ZAPIER_SIGNING_SECRET
			);

			if (!isValid) {
				logger.warn('Invalid signature', {
					correlationId,
					client_ip: clientIp,
					algorithm: parsed.algorithm,
				});
				return jsonResponse(
					{
						status: 'error',
						message: 'Invalid signature',
					},
					401,
					correlationId
				);
			}

			logger.debug('Signature verified successfully', { correlationId });
		}

		// Parse request body
		let body: ZapierSubscribeRequest;
		try {
			body = JSON.parse(bodyText) as ZapierSubscribeRequest;
		} catch (error) {
			logger.error('Invalid JSON in subscribe request', { correlationId, error: String(error) });
			return jsonResponse(
				{
					status: 'error',
					message: 'Invalid JSON in request body',
					validation_error: {
						field: 'body',
						constraint: 'format',
						expected: 'Valid JSON',
					},
				},
				400,
				correlationId
			);
		}

		const { url } = body;

		// Validate URL field exists
		if (!url) {
			logger.warn('Missing url field in subscribe request', { correlationId });
			return jsonResponse(
				{
					status: 'error',
					message: 'Missing url field',
					validation_error: {
						field: 'url',
						constraint: 'required',
					},
				},
				400,
				correlationId
			);
		}

		// Validate URL format
		const validation = validateZapierUrl(url);
		if (!validation.valid) {
			logger.warn('Invalid webhook URL', { correlationId, url, reason: validation.reason });
			return jsonResponse(
				{
					status: 'error',
					message: `Invalid URL. ${validation.reason}`,
					validation_error: {
						field: 'url',
						constraint: 'format',
						expected: 'HTTPS URL from hooks.zapier.com',
					},
				},
				400,
				correlationId
			);
		}

		// Check for duplicate subscription
		const existing = await env.DB.prepare('SELECT id FROM zapier_webhooks WHERE url = ?').bind(url).first();

		if (existing) {
			logger.info('Duplicate webhook subscription attempt', { correlationId, url });
			return jsonResponse(
				{
					status: 'error',
					message: 'Webhook already subscribed',
				},
				409,
				correlationId
			);
		}

		// Create new subscription
		const webhookId = `webhook_${crypto.randomUUID()}`;
		const now = new Date().toISOString();

		await env.DB.prepare(
			`INSERT INTO zapier_webhooks (id, url, status, created_at, retry_count)
       VALUES (?, ?, 'active', ?, 0)`
		)
			.bind(webhookId, url, now)
			.run();

		logger.info('Webhook subscription created', { correlationId, webhookId, url, client_ip: clientIp });

		const response: ZapierSubscribeResponse = {
			status: 'success',
			url,
			id: webhookId,
			message: 'Webhook subscription created',
		};

		return jsonResponse(response, 201, correlationId, {
			'X-RateLimit-Limit': rateLimit.limit.toString(),
			'X-RateLimit-Remaining': rateLimit.remaining.toString(),
			'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
		});
	} catch (error) {
		logger.error('Error in handleZapierSubscribe', {
			correlationId,
			error: String(error),
			message: error instanceof Error ? error.message : 'Unknown error',
		});

		return jsonResponse({ status: 'error', message: 'Internal server error' }, 500, correlationId);
	}
}

/**
 * GET /zapier/hook
 * Return sample event data for Zapier to test the webhook
 *
 * This endpoint is called by Zapier when:
 * 1. User is setting up a new Zap and needs to see example data
 * 2. Zapier is verifying the webhook is working correctly
 *
 * Security:
 *   - Rate limited to 60 requests per IP per hour
 *   - Event payload validated against schema
 *   - Includes X-Zapier-Signature header if secret configured
 *
 * Response:
 *   200 OK - Sample event data with signature
 *   429 Too Many Requests - Rate limit exceeded
 *   500 Internal Server Error - Event validation or generation error
 */
export async function handleZapierTest(request: Request, env: Env): Promise<Response> {
	const correlationId = crypto.randomUUID();

	try {
		// Get client IP for rate limiting
		const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';

		// Rate limiting check (60 requests per hour)
		const rateLimit = RateLimiter.checkSample(clientIp, correlationId);
		if (!rateLimit.allowed) {
			logger.warn('Sample endpoint rate limit exceeded', {
				correlationId,
				client_ip: clientIp,
				retry_after: rateLimit.retryAfter,
			});

			return jsonResponse(
				{
					status: 'error',
					message: 'Rate limit exceeded. Maximum 60 requests per hour.',
				},
				429,
				correlationId,
				{
					'Retry-After': rateLimit.retryAfter?.toString() || '3600',
					'X-RateLimit-Limit': rateLimit.limit.toString(),
					'X-RateLimit-Remaining': '0',
					'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
				}
			);
		}

		// Generate sample event matching the real event schema
		const sampleEvent: ZapierTestResponse = {
			event_id: `evt_test_${Date.now()}`,
			event_type: 'test_event',
			timestamp: new Date().toISOString(),
			payload: {
				message: 'Sample test event from TriggersAPI',
				source: 'zapier_test',
				test: true,
				user_id: 'user_sample_123',
				email: 'test@example.com',
			},
			metadata: {
				correlation_id: `corr_test_${crypto.randomUUID()}`,
				source_ip: clientIp,
				user_agent: request.headers.get('user-agent') || 'zapier-test',
			},
			created_at: new Date().toISOString(),
		};

		// Validate event structure
		const validation = validateZapierEvent(sampleEvent);
		if (!validation.valid) {
			logger.error('Sample event validation failed', {
				correlationId,
				errors: validation.errors,
			});
			return jsonResponse(
				{
					status: 'error',
					message: 'Sample event validation failed',
					validation_errors: validation.errors,
				},
				500,
				correlationId
			);
		}

		// Add signature header if secret is configured
		const headers: Record<string, string> = {
			'X-RateLimit-Limit': rateLimit.limit.toString(),
			'X-RateLimit-Remaining': rateLimit.remaining.toString(),
			'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
		};

		if (env.ZAPIER_SIGNING_SECRET) {
			headers['X-Zapier-Signature'] = await SignatureService.createSignatureHeader(
				sampleEvent,
				env.ZAPIER_SIGNING_SECRET
			);
		}

		logger.info('Sample event requested', { correlationId, client_ip: clientIp });

		// Zapier expects an array of events for performList
		return jsonResponse([sampleEvent], 200, correlationId, headers);
	} catch (error) {
		logger.error('Error in handleZapierTest', {
			correlationId,
			error: String(error),
			message: error instanceof Error ? error.message : 'Unknown error',
		});

		return jsonResponse({ status: 'error', message: 'Internal server error' }, 500, correlationId);
	}
}

/**
 * DELETE /zapier/hook
 * Unsubscribe a webhook URL from receiving event notifications
 *
 * Request body:
 *   { "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/" }
 *
 * Response:
 *   200 OK - Webhook subscription removed
 *   400 Bad Request - Missing url field
 *   404 Not Found - Webhook not found
 *   500 Internal Server Error - Database error
 */
export async function handleZapierUnsubscribe(request: Request, env: Env): Promise<Response> {
	const correlationId = crypto.randomUUID();

	try {
		// Parse request body
		let body: ZapierUnsubscribeRequest;
		try {
			body = (await request.json()) as ZapierUnsubscribeRequest;
		} catch (error) {
			logger.error('Invalid JSON in unsubscribe request', { correlationId, error: String(error) });
			return jsonResponse(
				{ status: 'error', message: 'Invalid JSON in request body' },
				400,
				correlationId
			);
		}

		const { url } = body;

		// Validate URL field exists
		if (!url) {
			logger.warn('Missing url field in unsubscribe request', { correlationId });
			return jsonResponse({ status: 'error', message: 'Missing url field' }, 400, correlationId);
		}

		// Delete webhook from database
		const result = await env.DB.prepare('DELETE FROM zapier_webhooks WHERE url = ?').bind(url).run();

		if (result.success && result.meta.changes === 0) {
			logger.warn('Webhook not found for unsubscribe', { correlationId, url });
			return jsonResponse(
				{
					status: 'error',
					message: 'Webhook not found',
				},
				404,
				correlationId
			);
		}

		logger.info('Webhook subscription removed', { correlationId, url });

		const response: ZapierUnsubscribeResponse = {
			status: 'success',
			message: 'Webhook subscription removed',
		};

		return jsonResponse(response, 200, correlationId);
	} catch (error) {
		logger.error('Error in handleZapierUnsubscribe', {
			correlationId,
			error: String(error),
			message: error instanceof Error ? error.message : 'Unknown error',
		});

		return jsonResponse({ status: 'error', message: 'Internal server error' }, 500, correlationId);
	}
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Validate Zapier webhook URL
 * Must be HTTPS from hooks.zapier.com domain
 */
function validateZapierUrl(url: string): { valid: boolean; reason?: string } {
	try {
		const urlObj = new URL(url);

		// Must be HTTPS
		if (urlObj.protocol !== 'https:') {
			return { valid: false, reason: 'Must be HTTPS' };
		}

		// Must be from Zapier domain
		if (!urlObj.hostname.includes('zapier.com')) {
			return { valid: false, reason: 'Must be from hooks.zapier.com domain' };
		}

		// Must have /hooks path
		if (!urlObj.pathname.startsWith('/hooks')) {
			return { valid: false, reason: 'Must be a Zapier hooks URL' };
		}

		return { valid: true };
	} catch (error) {
		return { valid: false, reason: 'Invalid URL format' };
	}
}

/**
 * Create JSON response with proper headers and correlation ID
 *
 * Automatically adds security headers:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 1; mode=block
 * - Strict-Transport-Security: max-age=31536000
 *
 * @param data - Response data
 * @param status - HTTP status code
 * @param correlationId - Request correlation ID
 * @param additionalHeaders - Additional headers to include
 * @returns Response with security headers
 */
function jsonResponse(
	data: unknown,
	status: number,
	correlationId: string,
	additionalHeaders?: Record<string, string>
): Response {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'X-Correlation-ID': correlationId,
		// Security headers
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		'X-XSS-Protection': '1; mode=block',
		'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
		...additionalHeaders,
	};

	return new Response(JSON.stringify(data), {
		status,
		headers,
	});
}
