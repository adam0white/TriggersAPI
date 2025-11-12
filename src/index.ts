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
import { handleGetMetricsHistory } from './routes/metrics-history';
import { handleInboxQuery, handleAckEvent, handleRetryEvent } from './routes/inbox';
import { handleGetLogs } from './routes/logs-api';
import { handleApiDocs, handleOpenApiSpec } from './routes/api-docs';
import { validateBearerToken, unauthorizedResponse, serviceErrorResponse } from './middleware/auth';
import { processEventBatch } from './queue/consumer';
import { ProcessEventWorkflow } from './workflows/process-event';
import { processTailEvents } from './tail/worker';
import { MetricsCalculator } from './lib/metrics-calculator';
import { logger } from './lib/logger';

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

		// Logs API endpoint (public for dashboard)
		if (path === '/api/logs' && method === 'GET') {
			return handleGetLogs(request, env, correlationId);
		}

		// Metrics history API endpoint (public for dashboard charts)
		if (path === '/api/metrics/history' && method === 'GET') {
			return handleGetMetricsHistory(request, env, correlationId);
		}

		// API Documentation routes (public)
		if (path === '/api/docs' && method === 'GET') {
			return handleApiDocs();
		}

		// Serve OpenAPI spec file (public)
		if (path === '/openapi.yaml' && method === 'GET') {
			return handleOpenApiSpec();
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

		// GET /inbox - Query events with filtering and pagination
		if (method === 'GET' && path === '/inbox') {
			return handleInboxQuery(request, env, correlationId);
		}

		// POST /inbox/:eventId/ack - Acknowledge and delete event
		if (method === 'POST' && path.startsWith('/inbox/') && path.endsWith('/ack')) {
			const pathParts = path.split('/');
			// Expected: ['', 'inbox', '{eventId}', 'ack']
			if (pathParts.length === 4) {
				const eventId = pathParts[2];
				return handleAckEvent(request, env, ctx, eventId);
			}
		}

		// POST /inbox/:eventId/retry - Retry failed event
		if (method === 'POST' && path.startsWith('/inbox/') && path.endsWith('/retry')) {
			const pathParts = path.split('/');
			// Expected: ['', 'inbox', '{eventId}', 'retry']
			if (pathParts.length === 4) {
				const eventId = pathParts[2];
				return handleRetryEvent(request, env, ctx, eventId);
			}
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
	 * Implemented in Epic 4, Story 4.1
	 */
	async tail(events: TraceItem[], env: Env): Promise<void> {
		await processTailEvents(events, env);
	},

	/**
	 * Scheduled handler for periodic tasks
	 * Runs metrics calculations every 30 seconds
	 * Implemented in Epic 4, Story 4.3
	 */
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		try {
			logger.info('Scheduled metrics calculation started', {
				scheduledTime: new Date(controller.scheduledTime).toISOString(),
				cron: controller.cron,
			});

			// Create metrics calculator instance
			const calculator = new MetricsCalculator(env.DB, env.METRICS_KV, logger);

			// Run all metrics calculations
			await calculator.runAllMetricsCalculations();

			logger.info('Scheduled metrics calculation completed');
		} catch (error) {
			logger.error('Scheduled metrics calculation failed', {
				error: String(error),
				message: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	},
} satisfies ExportedHandler<Env>;
