/**
 * Type definitions for metrics calculation and storage
 * Story 4.3: Metrics Calculation
 */

/**
 * Latency percentile metrics for an endpoint
 */
export interface LatencyMetrics {
	/** 50th percentile (median) latency in milliseconds */
	p50: number;
	/** 95th percentile latency in milliseconds */
	p95: number;
	/** 99th percentile latency in milliseconds */
	p99: number;
	/** Maximum observed latency in milliseconds */
	max: number;
	/** Average latency in milliseconds */
	avg: number;
	/** Number of data points used in calculation */
	count: number;
	/** Endpoint path (e.g., /events, /inbox) */
	endpoint: string;
	/** Timestamp when metrics were calculated */
	timestamp: string;
}

/**
 * Error rate metrics
 */
export interface ErrorMetrics {
	/** Total number of errors */
	total_errors: number;
	/** Error rate as percentage */
	error_rate: number;
	/** Total requests in time window */
	total_requests: number;
	/** Errors grouped by category (validation, auth, etc) */
	by_type: Record<string, number>;
	/** Errors grouped by status class (4xx, 5xx) */
	by_status: { '4xx': number; '5xx': number };
	/** Timestamp when metrics were calculated */
	timestamp: string;
}

/**
 * Success rate metrics
 */
export interface SuccessMetrics {
	/** Success rate as percentage (2xx responses) */
	success_rate: number;
	/** Total successful requests (2xx) */
	successful_requests: number;
	/** Total requests in time window */
	total_requests: number;
	/** Timestamp when metrics were calculated */
	timestamp: string;
}

/**
 * Queue depth and DLQ metrics
 */
export interface QueueMetrics {
	/** Number of pending events in queue */
	queue_depth: number;
	/** Number of messages in Dead Letter Queue */
	dlq_count: number;
	/** Timestamp when metrics were captured */
	timestamp: string;
}

/**
 * Throughput metrics
 */
export interface ThroughputMetrics {
	/** Requests per second */
	rps: number;
	/** Events per second */
	eps: number;
	/** Total requests in time window */
	total_requests: number;
	/** Peak requests per second in window */
	peak_rps?: number;
	/** Timestamp when metrics were calculated */
	timestamp: string;
}

/**
 * Event lifecycle metrics
 */
export interface EventLifecycleMetrics {
	/** Total events ingested (lifetime) */
	total_events: number;
	/** Events currently pending */
	pending_events: number;
	/** Events successfully delivered */
	delivered_events: number;
	/** Events that failed */
	failed_events: number;
	/** Delivery rate as percentage */
	delivery_rate: number;
	/** Average retry count for delivered events */
	avg_retries: number;
	/** Timestamp when metrics were calculated */
	timestamp: string;
}

/**
 * CPU execution time metrics
 */
export interface CPUMetrics {
	/** 50th percentile CPU time in milliseconds */
	p50: number;
	/** 95th percentile CPU time in milliseconds */
	p95: number;
	/** 99th percentile CPU time in milliseconds */
	p99: number;
	/** Maximum CPU time in milliseconds */
	max: number;
	/** Average CPU time in milliseconds */
	avg: number;
	/** Worker name (if applicable) */
	worker?: string;
	/** Timestamp when metrics were calculated */
	timestamp: string;
}

/**
 * Payload size metrics
 */
export interface PayloadMetrics {
	/** Average request payload size in bytes */
	avg_request_size: number;
	/** Average response payload size in bytes */
	avg_response_size: number;
	/** Maximum request payload size in bytes */
	max_request_size: number;
	/** Maximum response payload size in bytes */
	max_response_size: number;
	/** Timestamp when metrics were calculated */
	timestamp: string;
}

/**
 * Database query performance metrics
 */
export interface DatabaseMetrics {
	/** Average query execution time in milliseconds */
	avg_query_time: number;
	/** Number of slow queries (>100ms) */
	slow_query_count: number;
	/** Total queries executed */
	total_queries: number;
	/** Timestamp when metrics were calculated */
	timestamp: string;
}

/**
 * Historical metric snapshot for D1 storage
 */
export interface MetricHistoryRecord {
	metric_id: string;
	metric_type: string;
	endpoint: string | null;
	value: number;
	unit: string;
	timestamp: string;
	data_points: number;
	confidence: number;
	created_at?: string;
}

/**
 * KV storage format for metrics
 */
export interface KVMetricValue {
	value: number;
	unit?: string;
	timestamp: string;
	endpoint?: string;
	[key: string]: any;
}

/**
 * Aggregated metrics for dashboard display
 */
export interface AggregatedMetrics {
	latency: Record<string, LatencyMetrics>;
	errors: ErrorMetrics;
	success: SuccessMetrics;
	queue: QueueMetrics;
	throughput: ThroughputMetrics;
	events: EventLifecycleMetrics;
	cpu: CPUMetrics;
	payload: PayloadMetrics;
	database?: DatabaseMetrics;
	last_updated: string;
}
