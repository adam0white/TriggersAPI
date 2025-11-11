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
import { validateBearerToken, unauthorizedResponse, serviceErrorResponse } from './middleware/auth';

interface EventPayload {
	payload: Record<string, any>;
	metadata?: Record<string, any>;
}

/**
 * Workflow: Process Event
 * Durable workflow for event validation, storage, and metrics
 * Will be implemented in Epic 2 with proper Workflow API
 * Note: Workflow class export commented out until implementation
 */
// export class ProcessEventWorkflow extends WorkflowEntrypoint<Env, EventPayload> {
// 	async run(event: WorkflowEvent<EventPayload>, step: WorkflowStep): Promise<void> {
// 		// Workflow stub - will be implemented in Epic 2
// 		console.log('ProcessEventWorkflow stub: workflow triggered');
// 	}
// }

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
	 * Implemented in Epic 2
	 */
	async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
		// Queue consumer stub - will be implemented in Epic 2
		console.log(
			JSON.stringify({
				level: 'info',
				message: 'Queue consumer received batch',
				batch_size: batch.messages.length,
				queue: batch.queue,
				timestamp: new Date().toISOString(),
			})
		);

		// Log each message for debugging
		for (const message of batch.messages) {
			console.log(
				JSON.stringify({
					level: 'debug',
					message: 'Queue message received',
					message_id: message.id,
					message_timestamp: message.timestamp.toISOString(),
					body: message.body,
				})
			);
		}
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
