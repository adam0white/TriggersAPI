
import { logger } from '../lib/logger';

/**
 * Handle POST /admin/cleanup request
 *
 * Deletes old data from D1 tables to reduce storage usage.
 * Keeps only the last 24 hours of data.
 *
 * @param request - HTTP request
 * @param env - Cloudflare Worker environment bindings
 * @param correlationId - Request correlation ID for tracing
 * @returns JSON response with status and deleted counts
 */
export async function handleDataCleanup(request: Request, env: Env, correlationId: string): Promise<Response> {
    logger.info('POST /admin/cleanup request received', {
        correlation_id: correlationId,
    });

    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Use batch for atomic deletion
        const batchParams = [
            env.DB.prepare(`DELETE FROM log_entries WHERE timestamp < ?`).bind(oneDayAgo),
            env.DB.prepare(`DELETE FROM metrics_history WHERE timestamp < ?`).bind(oneDayAgo),
            // Only delete finalized events
            env.DB.prepare(`DELETE FROM events WHERE created_at < ? AND status IN ('delivered', 'failed')`).bind(oneDayAgo)
        ];

        const results = await env.DB.batch(batchParams);

        const deletedCounts = {
            log_entries: results[0].meta.changes,
            metrics_history: results[1].meta.changes,
            events: results[2].meta.changes
        };

        logger.info('Data cleanup completed', {
            correlation_id: correlationId,
            deleted: deletedCounts
        });

        return new Response(
            JSON.stringify({
                status: 'success',
                message: 'Data cleanup completed',
                deleted: deletedCounts,
                timestamp: new Date().toISOString(),
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Correlation-ID': correlationId,
                },
            },
        );
    } catch (error) {
        logger.error('Failed to cleanup data', {
            correlation_id: correlationId,
            error: error instanceof Error ? error.message : 'Unknown',
        });

        return new Response(
            JSON.stringify({
                error: {
                    code: 'CLEANUP_FAILED',
                    message: 'Failed to cleanup data',
                    timestamp: new Date().toISOString(),
                },
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Correlation-ID': correlationId,
                },
            },
        );
    }
}
