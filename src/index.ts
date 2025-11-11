/**
 * TriggersAPI - Main Worker Entry Point
 *
 * Edge-native event ingestion and management API built on Cloudflare Workers.
 * This Worker handles HTTP requests, queue processing, and observability.
 *
 * Architecture:
 * - fetch(): HTTP API routes and dashboard
 * - queue(): Batch event processing
 * - tail(): Observability and metrics capture
 *
 * Run locally: npm run dev
 * Deploy: npm run deploy
 */

import { handlePostEvents } from './routes/events';
import { handleDashboard } from './routes/dashboard';
import { handleGetMetrics } from './routes/metrics';
import { validateBearerToken, unauthorizedResponse, serviceErrorResponse } from './middleware/auth';
import { processEventBatch } from './queue/consumer';
import { ProcessEventWorkflow } from './workflows/process-event';

/**
 * Export Workflow for Cloudflare Workers
 * Epic 2.3: ProcessEventWorkflow for durable event processing
 */
export { ProcessEventWorkflow };

// Routes that require authentication
const PROTECTED_ROUTES = ['/events', '/inbox'];

// Public routes (no auth required)
const PUBLIC_ROUTES = ['/'];

export default {
	/**
	 * Main HTTP request handler
	 * Handles API routes for event ingestion, retrieval, and dashboard
	 */
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Generate or extract correlation ID for request tracing
		const correlationIdHeader = 'x-correlation-id';
		const correlationId = request.headers.get(correlationIdHeader) || crypto.randomUUID();

		// Simple route matching
		const url = new URL(request.url);
		const method = request.method;
		const path = url.pathname;

		// Handle public routes (no auth required)
		if (path === '/' && method === 'GET') {
			return handleDashboard(request);
		}

		// Metrics endpoint (public for dashboard)
		if (path === '/metrics' && method === 'GET') {
			return handleGetMetrics(request, env, correlationId);
		}

		// Check if route requires auth
		const isProtected = PROTECTED_ROUTES.some((route) => path.startsWith(route));

		if (isProtected) {
			// Validate authentication
			const authContext = await validateBearerToken(request, env, correlationId);

			if (!authContext.isAuthenticated) {
				// Distinguish between auth errors and service errors
				if (authContext.error?.code === 'AUTH_SERVICE_ERROR') {
					return serviceErrorResponse(authContext.error, correlationId);
				}
				return unauthorizedResponse(authContext.error!, correlationId);
			}
		}

		// Route to handlers
		if (method === 'POST' && path === '/events') {
			return handlePostEvents(request, env, correlationId);
		}

		// 404 - Not found
		return new Response('Not found', { status: 404 });
	},

	/**
	 * Queue consumer handler
	 * Processes batched events from Cloudflare Queue
	 * Implemented in Epic 2.2
	 */
	async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
		// Cast batch to expected type (validation happens inside processEventBatch)
		await processEventBatch(batch as MessageBatch<any>, env);
	},

	/**
	 * Tail Worker handler
	 * Captures logs, metrics, and traces for observability
	 * Implemented in Epic 4
	 */
	async tail(events: TraceItem[], env: Env): Promise<void> {
		// Tail Worker stub - will be implemented in Epic 4
		console.log(`Tail Worker stub: received ${events.length} trace events`);
	},
} satisfies ExportedHandler<Env>;
