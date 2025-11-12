/**
 * TypeScript type definitions for Metrics & History Panels
 * Story 7.5: Metrics Pulse & Delivery Analysis
 */

/**
 * Metric tile data
 */
export interface MetricTile {
	/** Metric identifier */
	id: string;
	/** Display label */
	label: string;
	/** Current value */
	value: string | number;
	/** Subtext description */
	subtext: string;
	/** Icon emoji or component */
	icon: string;
	/** Delta change from last run */
	delta: MetricDelta;
	/** Sparkline data points */
	sparkline: number[];
	/** Current state (normal, warning, critical) */
	state: 'normal' | 'warning' | 'critical';
	/** Unit of measurement */
	unit?: string;
}

/**
 * Delta change indicator
 */
export interface MetricDelta {
	/** Numeric change value */
	value: number;
	/** Direction of change */
	direction: 'up' | 'down' | 'neutral';
	/** Display text (e.g., "+25 events", "-15ms") */
	text: string;
	/** Whether change is positive (green) or negative (red) */
	isPositive: boolean;
	/** Timestamp of comparison */
	comparedTo?: string;
}

/**
 * Aggregated metrics for a session
 */
export interface SessionMetrics {
	/** Total events submitted */
	totalEvents: number;
	/** Success rate percentage */
	successRate: number;
	/** Successful event count */
	successfulEvents: number;
	/** Failed event count */
	failedEvents: number;
	/** Average latency in milliseconds */
	avgLatency: number;
	/** Latency percentiles */
	latencyPercentiles: {
		p50: number;
		p95: number;
		p99: number;
	};
	/** Current queue depth */
	queueDepth: number;
	/** Dead Letter Queue count */
	dlqCount: number;
	/** Events per minute */
	eventsPerMinute: number[];
	/** Success rate trend */
	successRateTrend: number[];
	/** Latency trend */
	latencyTrend: number[];
	/** Queue depth trend */
	queueDepthTrend: number[];
	/** Timestamp of metrics */
	timestamp: string;
}

/**
 * Run history entry
 */
export interface RunHistoryEntry {
	/** Unique run identifier */
	runId: string;
	/** Run status */
	status: 'success' | 'failed' | 'partial';
	/** Run type */
	type: 'default' | 'debug' | 'bulk';
	/** Timestamp of run */
	timestamp: string;
	/** Average latency for this run */
	avgLatency: number;
	/** Event count (for batch runs) */
	eventCount?: number;
	/** Failed event count (for batch runs) */
	failedCount?: number;
	/** Payload used */
	payload: Record<string, unknown>;
	/** Debug flags used */
	debugFlags?: Record<string, unknown>;
	/** Duration of run */
	duration?: number;
}

/**
 * DLQ (Dead Letter Queue) event
 */
export interface DLQEvent {
	/** Event ID */
	eventId: string;
	/** Run ID that generated this failure */
	runId: string;
	/** Failure reason */
	failureReason: string;
	/** Error code */
	errorCode: string;
	/** Timestamp of failure */
	timestamp: string;
	/** Original payload */
	payload: Record<string, unknown>;
	/** Stage where failure occurred */
	failedStage: 'ingress' | 'queue' | 'processing' | 'inbox';
	/** Whether retry is eligible */
	retryEligible: boolean;
}

/**
 * Delivery analysis comparison
 */
export interface DeliveryComparison {
	/** Current run metrics */
	current: SessionMetrics;
	/** Baseline/previous run metrics */
	baseline: SessionMetrics;
	/** Computed deltas */
	deltas: {
		totalEvents: MetricDelta;
		successRate: MetricDelta;
		avgLatency: MetricDelta;
		queueDepth: MetricDelta;
	};
}

/**
 * History filter options
 */
export interface HistoryFilters {
	/** Filter by status */
	status?: 'all' | 'success' | 'failed' | 'partial';
	/** Filter by type */
	type?: 'all' | 'default' | 'debug' | 'bulk';
	/** Time range filter */
	timeRange?: 'last-hour' | 'today' | 'all';
	/** Search query (run ID) */
	searchQuery?: string;
}

/**
 * Props for MetricsPanel component
 */
export interface MetricsPanelProps {
	/** Additional CSS classes */
	className?: string;
}

/**
 * Props for HistoryPanel component
 */
export interface HistoryPanelProps {
	/** Additional CSS classes */
	className?: string;
	/** Callback when replay is triggered */
	onReplay?: (entry: RunHistoryEntry) => void;
	/** Maximum runs to display */
	maxRuns?: number;
}

/**
 * Props for DLQWidget component
 */
export interface DLQWidgetProps {
	/** DLQ event count */
	count: number;
	/** Callback when DLQ is expanded */
	onExpand?: () => void;
	/** Callback when retry all is triggered */
	onRetryAll?: () => void;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Props for MetricTile component
 */
export interface MetricTileProps {
	/** Metric data */
	metric: MetricTile;
	/** Click handler */
	onClick?: () => void;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Props for DeltaBadge component
 */
export interface DeltaBadgeProps {
	/** Delta data */
	delta: MetricDelta;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Props for Sparkline component
 */
export interface SparklineProps {
	/** Data points */
	data: number[];
	/** Chart type */
	type: 'bar' | 'line' | 'area' | 'step';
	/** Color variant */
	color?: 'accent' | 'warning' | 'success' | 'error';
	/** Width in pixels */
	width?: number;
	/** Height in pixels */
	height?: number;
	/** Additional CSS classes */
	className?: string;
}
