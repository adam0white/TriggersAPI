
import { MetricsCalculator } from '../lib/metrics-calculator';
import { logger } from '../lib/logger';

/**
 * Handle POST /metrics/calculate request
 *
 * Triggers on-demand metrics calculation
 *
 * @param request - HTTP request
 * @param env - Cloudflare Worker environment bindings
 * @param correlationId - Request correlation ID for tracing
 * @returns JSON response with status
 */
export async function handleCalculateMetrics(request: Request, env: Env, correlationId: string): Promise<Response> {
    logger.info('POST /metrics/calculate request received', {
        correlation_id: correlationId,
    });

    try {
        if (!env.DB || !env.METRICS_KV) {
            const missing = [];
            if (!env.DB) missing.push('DB');
            if (!env.METRICS_KV) missing.push('METRICS_KV');

            logger.error('Missing required bindings', {
                correlation_id: correlationId,
                missing_bindings: missing,
            });

            return new Response(
                JSON.stringify({
                    error: {
                        code: 'INTERNAL_SERVER_ERROR',
                        message: `Missing required bindings: ${missing.join(', ')}`,
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

        const calculator = new MetricsCalculator(env.DB, env.METRICS_KV, logger);

        // Run all metrics calculations
        await calculator.runAllMetricsCalculations();

        logger.info('Metrics calculated successfully', {
            correlation_id: correlationId,
        });

        return new Response(
            JSON.stringify({
                status: 'success',
                message: 'Metrics calculation completed',
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
        logger.error('Failed to calculate metrics', {
            correlation_id: correlationId,
            error: error instanceof Error ? error.message : 'Unknown',
        });

        return new Response(
            JSON.stringify({
                error: {
                    code: 'CALCULATION_FAILED',
                    message: 'Failed to calculate metrics',
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
