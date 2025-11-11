/**
 * Inbox Query Route - GET /inbox
 *
 * Retrieves events from D1 with advanced filtering and pagination support.
 * Provides foundation for browsing stored events through API and UI.
 *
 * Query Parameters:
 * - status: Filter by event status (pending|delivered|failed) - supports comma-separated values
 * - from: Start timestamp (ISO-8601)
 * - to: End timestamp (ISO-8601)
 * - created_date: Filter by date only (YYYY-MM-DD)
 * - min_retries: Minimum retry count filter
 * - max_retries: Maximum retry count filter
 * - metadata.<key>: Filter by metadata field value
 * - payload.<key>: Filter by payload field value
 * - sort: Sort field (created_at|updated_at|retry_count, default: created_at)
 * - order: Sort order (asc|desc, default: desc)
 * - limit: Max results per page (default: 50, max: 1000)
 * - offset: Pagination offset (default: 0)
 * - cursor: Cursor-based pagination (base64-encoded)
 *
 * Response Format:
 * {
 *   data: Event[],
 *   total: number,
 *   limit: number,
 *   offset: number,
 *   next_cursor?: string,
 *   timestamp: string,
 *   _metadata: {
 *     filters_applied: number,
 *     sort_field: string,
 *     sort_order: string
 *   }
 * }
 */

import { Event } from '../types/events';
import { EventQueries } from '../db/queries';
import { badRequest, internalError } from '../middleware/error-handler';
import { MetricsManager } from '../lib/metrics';
import { isValidUUID } from '../lib/validation';

export interface InboxResponse {
  data: Event[];
  total: number;
  limit: number;
  offset: number;
  next_cursor?: string;
  timestamp: string;
  _metadata: {
    filters_applied: number;
    sort_field: string;
    sort_order: string;
  };
}

/**
 * Handle GET /inbox requests with advanced filtering
 * Queries events from D1 with optional filtering, sorting, and pagination
 *
 * @param request - HTTP request
 * @param env - Cloudflare Worker environment with D1 binding
 * @param correlationId - Request correlation ID for tracing
 * @returns Response with events array and pagination metadata
 */
export async function handleInboxQuery(
  request: Request,
  env: Env,
  correlationId: string
): Promise<Response> {
  try {
    // Parse query parameters
    const url = new URL(request.url);

    // Parse status (supports comma-separated multiple values)
    const statusParam = url.searchParams.get('status');
    const statusList = statusParam ? statusParam.split(',').map(s => s.trim()) : [];

    // Validate status values
    const validStatuses = ['pending', 'delivered', 'failed'];
    for (const status of statusList) {
      if (!validStatuses.includes(status)) {
        return badRequest(
          'INVALID_PARAMETER',
          correlationId,
          `Invalid status: ${status}. Must be one of: pending, delivered, failed`
        );
      }
    }

    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const createdDate = url.searchParams.get('created_date');

    // Parse retry count filters
    const minRetriesParam = url.searchParams.get('min_retries');
    const maxRetriesParam = url.searchParams.get('max_retries');
    let minRetries: number | undefined;
    let maxRetries: number | undefined;

    if (minRetriesParam) {
      minRetries = parseInt(minRetriesParam, 10);
      if (isNaN(minRetries) || minRetries < 0) {
        return badRequest('INVALID_PARAMETER', correlationId, 'min_retries must be >= 0');
      }
    }

    if (maxRetriesParam) {
      maxRetries = parseInt(maxRetriesParam, 10);
      if (isNaN(maxRetries) || maxRetries < 0) {
        return badRequest('INVALID_PARAMETER', correlationId, 'max_retries must be >= 0');
      }
    }

    // Parse metadata filters (metadata.key=value)
    const metadataFilters: Record<string, string> = {};
    for (const [key, value] of url.searchParams) {
      if (key.startsWith('metadata.')) {
        const metadataKey = key.substring('metadata.'.length);
        if (metadataKey) {
          metadataFilters[metadataKey] = value;
        }
      }
    }

    // Parse payload filters (payload.key=value)
    const payloadFilters: Record<string, string> = {};
    for (const [key, value] of url.searchParams) {
      if (key.startsWith('payload.')) {
        const payloadKey = key.substring('payload.'.length);
        if (payloadKey) {
          payloadFilters[payloadKey] = value;
        }
      }
    }

    // Validate filter count (DoS prevention: max 10 active filters)
    const filterCount =
      statusList.length +
      (from ? 1 : 0) +
      (to ? 1 : 0) +
      (createdDate ? 1 : 0) +
      (minRetries !== undefined ? 1 : 0) +
      (maxRetries !== undefined ? 1 : 0) +
      Object.keys(metadataFilters).length +
      Object.keys(payloadFilters).length;

    if (filterCount > 10) {
      return badRequest(
        'TOO_MANY_FILTERS',
        correlationId,
        'Maximum 10 filters allowed per query (DoS prevention)'
      );
    }

    // Parse sort and order
    const sort = url.searchParams.get('sort') || 'created_at';
    const order = url.searchParams.get('order') || 'desc';

    // Validate sort field
    const validSortFields = ['created_at', 'updated_at', 'retry_count'];
    if (!validSortFields.includes(sort)) {
      return badRequest(
        'INVALID_PARAMETER',
        correlationId,
        `Invalid sort field: ${sort}. Must be one of: ${validSortFields.join(', ')}`
      );
    }

    // Validate sort order
    if (order !== 'asc' && order !== 'desc') {
      return badRequest(
        'INVALID_PARAMETER',
        correlationId,
        `Invalid order: ${order}. Must be asc or desc`
      );
    }

    // Parse and validate limit (default: 50, max: 1000)
    const limitParam = url.searchParams.get('limit');
    let limit = 50;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return badRequest('INVALID_PARAMETER', correlationId, 'limit must be a positive integer');
      }
      limit = Math.min(parsedLimit, 1000);
    }

    // Parse and validate offset (default: 0, min: 0)
    const offsetParam = url.searchParams.get('offset');
    let offset = 0;
    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return badRequest('INVALID_PARAMETER', correlationId, 'offset must be >= 0');
      }
      offset = parsedOffset;
    }

    // Parse cursor for cursor-based pagination
    const cursorParam = url.searchParams.get('cursor');

    // Validate timestamp format if provided
    if (from && isNaN(Date.parse(from))) {
      return badRequest(
        'INVALID_PARAMETER',
        correlationId,
        `Invalid from timestamp: ${from}. Must be ISO-8601 format`
      );
    }

    if (to && isNaN(Date.parse(to))) {
      return badRequest(
        'INVALID_PARAMETER',
        correlationId,
        `Invalid to timestamp: ${to}. Must be ISO-8601 format`
      );
    }

    // Validate created_date format (YYYY-MM-DD)
    if (createdDate && !/^\d{4}-\d{2}-\d{2}$/.test(createdDate)) {
      return badRequest(
        'INVALID_PARAMETER',
        correlationId,
        `Invalid created_date: ${createdDate}. Must be YYYY-MM-DD format`
      );
    }

    // Query D1 with advanced filters
    const queries = new EventQueries(env.DB);

    // Decode cursor if provided
    let cursorObj = null;
    if (cursorParam) {
      cursorObj = queries.decodeCursor(cursorParam);
      if (!cursorObj) {
        return badRequest(
          'INVALID_CURSOR',
          correlationId,
          'Invalid cursor format'
        );
      }
    }

    const events = await queries.getEventsByAdvancedFilters({
      status: statusList.length > 0 ? statusList : undefined,
      from: from || undefined,
      to: to || undefined,
      createdDate: createdDate || undefined,
      minRetries,
      maxRetries,
      metadata: Object.keys(metadataFilters).length > 0 ? metadataFilters : undefined,
      payload: Object.keys(payloadFilters).length > 0 ? payloadFilters : undefined,
      sort: sort as 'created_at' | 'updated_at' | 'retry_count',
      order: order as 'asc' | 'desc',
      limit,
      offset,
      cursor: cursorObj,
    });

    const total = await queries.countEventsByAdvancedFilters({
      status: statusList.length > 0 ? statusList : undefined,
      from: from || undefined,
      to: to || undefined,
      createdDate: createdDate || undefined,
      minRetries,
      maxRetries,
      metadata: Object.keys(metadataFilters).length > 0 ? metadataFilters : undefined,
      payload: Object.keys(payloadFilters).length > 0 ? payloadFilters : undefined,
    });

    // Encode next cursor for cursor-based pagination
    let nextCursor: string | undefined;
    if (events.length >= limit) {
      const lastEvent = events[events.length - 1];
      nextCursor = queries.encodeCursor(lastEvent.event_id, lastEvent.created_at);
    }

    // Build response with pagination metadata
    const response: InboxResponse = {
      data: events,
      total,
      limit,
      offset,
      ...(nextCursor && { next_cursor: nextCursor }),
      timestamp: new Date().toISOString(),
      _metadata: {
        filters_applied: filterCount,
        sort_field: sort,
        sort_order: order,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Correlation-ID': correlationId,
      },
    });
  } catch (error) {
    console.error('Advanced inbox query error:', error);
    return internalError(correlationId, 'Failed to query inbox');
  }
}

/**
 * Handle POST /inbox/:eventId/ack requests
 * Acknowledges and permanently deletes an event from the system
 * Updates KV metrics to reflect the deletion
 *
 * @param request - HTTP request
 * @param env - Cloudflare Worker environment with D1 and KV bindings
 * @param ctx - Execution context for waitUntil()
 * @param eventId - Event ID to acknowledge/delete
 * @returns Response with deletion confirmation or error
 */
export async function handleAckEvent(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  eventId: string
): Promise<Response> {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    // Validate event_id format (UUID-like)
    if (!isValidUUID(eventId)) {
      return badRequest(
        'INVALID_PARAMETER',
        correlationId,
        `Invalid event ID format: ${eventId}`
      );
    }

    const queries = new EventQueries(env.DB);
    const metricsManager = new MetricsManager(env.METRICS_KV);

    // Retrieve event first (to know its status for metrics update)
    const event = await queries.getEventById(eventId);

    if (!event) {
      console.info(`[${correlationId}] Ack event not found: ${eventId}`);
      return new Response(
        JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: `Event ${eventId} not found`,
            timestamp: new Date().toISOString(),
            correlation_id: correlationId,
          },
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
          },
        }
      );
    }

    // Delete from D1
    await queries.deleteEvent(eventId);

    // Update metrics in KV (eventual consistency - fire and forget)
    ctx.waitUntil(
      (async () => {
        try {
          // Decrement status-specific count
          await metricsManager.decrementEventStatus(event.status as 'pending' | 'delivered' | 'failed');

          // Decrement total
          await metricsManager.decrementTotalEvents();

          console.info(
            `[${correlationId}] Metrics updated for ack: event_id=${eventId}, status=${event.status}`
          );
        } catch (err) {
          // Log but don't fail the response
          console.error(`[${correlationId}] Failed to update metrics after ack: ${err}`);
        }
      })()
    );

    const response = {
      data: {
        event_id: eventId,
        status: 'deleted',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    console.info(`[${correlationId}] Event acknowledged and deleted: ${eventId}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Correlation-ID': correlationId,
      },
    });
  } catch (error) {
    console.error(`[${correlationId}] Ack event error:`, error);
    return internalError(correlationId, 'Failed to acknowledge event');
  }
}

/**
 * Handle POST /inbox/:eventId/retry requests
 * Retries a failed event by incrementing retry count and reposting to queue
 * Validates event status, enforces max retry limit (3), and updates metrics
 *
 * @param request - HTTP request
 * @param env - Cloudflare Worker environment with D1, KV, and Queue bindings
 * @param ctx - Execution context for waitUntil()
 * @param eventId - Event ID to retry
 * @returns Response with retry confirmation or error
 */
export async function handleRetryEvent(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  eventId: string
): Promise<Response> {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    // Validate event_id format (UUID-like)
    if (!isValidUUID(eventId)) {
      return badRequest(
        'INVALID_PARAMETER',
        correlationId,
        `Invalid event ID format: ${eventId}`
      );
    }

    const queries = new EventQueries(env.DB);
    const metricsManager = new MetricsManager(env.METRICS_KV);

    // Retrieve event
    const event = await queries.getEventById(eventId);

    if (!event) {
      console.info(`[${correlationId}] Retry event not found: ${eventId}`);
      return new Response(
        JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: `Event ${eventId} not found`,
            timestamp: new Date().toISOString(),
            correlation_id: correlationId,
          },
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
          },
        }
      );
    }

    // Validate event is in 'failed' status
    if (event.status !== 'failed') {
      console.warn(
        `[${correlationId}] Cannot retry event with status: ${event.status} (must be 'failed')`
      );
      return new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_STATE',
            message: `Event status is '${event.status}', only 'failed' events can be retried`,
            timestamp: new Date().toISOString(),
            correlation_id: correlationId,
          },
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
          },
        }
      );
    }

    // Check if already at max retries (3)
    if (event.retry_count >= 3) {
      console.warn(
        `[${correlationId}] Event exceeded max retries (${event.retry_count}): ${eventId}`
      );
      return new Response(
        JSON.stringify({
          error: {
            code: 'MAX_RETRIES_EXCEEDED',
            message: `Event has already been retried ${event.retry_count} times (max: 3)`,
            timestamp: new Date().toISOString(),
            correlation_id: correlationId,
          },
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
          },
        }
      );
    }

    // Increment retry count
    await queries.incrementRetryCount(eventId);

    // Update status to 'retrying'
    await queries.updateEventStatus(eventId, 'retrying');

    // Repost to queue
    const queueMessage = {
      eventId,
      payload: event.payload,
      metadata: event.metadata,
      retryCount: event.retry_count + 1,
      correlationId,
      attempt: 'manual_retry',
    };

    await env.EVENT_QUEUE.send(queueMessage);

    // Update metrics: moving from 'failed' to 'retrying'
    ctx.waitUntil(
      (async () => {
        try {
          // Decrement failed count
          await metricsManager.decrementEventStatus('failed');
          console.info(`[${correlationId}] Metrics updated for retry: event_id=${eventId}`);
        } catch (err) {
          console.error(`[${correlationId}] Failed to update metrics after retry: ${err}`);
        }
      })()
    );

    const response = {
      data: {
        event_id: eventId,
        status: 'retrying',
        new_attempt: event.retry_count + 1,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    console.info(
      `[${correlationId}] Event queued for retry: ${eventId}, attempt: ${event.retry_count + 1}`
    );

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Correlation-ID': correlationId,
      },
    });
  } catch (error) {
    console.error(`[${correlationId}] Retry event error:`, error);
    return internalError(correlationId, 'Failed to retry event');
  }
}
