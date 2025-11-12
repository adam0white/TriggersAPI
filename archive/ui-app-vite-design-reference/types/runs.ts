/**
 * TypeScript type definitions for Run Command Panel
 * Story 7.2: Run Command Panel
 */

/**
 * Debug flags for triggering specific error scenarios
 */
export interface DebugFlags {
	/** Trigger a validation error response */
	trigger_validation_error?: boolean;
	/** Trigger a processing error response */
	trigger_processing_error?: boolean;
	/** Inject artificial latency in milliseconds (0-5000ms) */
	inject_latency_ms?: number;
}

/**
 * Request payload for default single-run submission
 */
export interface RunRequest {
	/** Authentication token for event submission */
	auth_token: string;
	/** Event payload data */
	payload: Record<string, unknown>;
	/** Optional debug flags */
	debug_flags?: DebugFlags;
}

/**
 * Request payload for batch run submission
 */
export interface BatchRunRequest {
	/** Authentication token for event submission */
	auth_token: string;
	/** Number of events to submit in batch (5-100) */
	batch_size: number;
	/** Template payload for all events in batch */
	payload_template: Record<string, unknown>;
	/** Optional debug flags */
	debug_flags?: DebugFlags;
	/** Optional latency injection for batch runs */
	inject_latency_ms?: number;
}

/**
 * Run status enumeration
 */
export type RunStatus =
	| 'idle'
	| 'submitting'
	| 'ingress'
	| 'queue'
	| 'processing'
	| 'inbox'
	| 'success'
	| 'failed'
	| 'retry';

/**
 * Stage timing information
 */
export interface StageTimings {
	ingress_ms?: number;
	queue_ms?: number;
	processing_ms?: number;
	total_ms?: number;
}

/**
 * Error information
 */
export interface RunError {
	code: string;
	message: string;
	details?: string;
}

/**
 * Run status response from API
 */
export interface RunResponse {
	/** Unique run identifier */
	run_id: string;
	/** Current run status */
	status: RunStatus;
	/** Timestamp of status update */
	timestamp: string;
	/** Stage timing information */
	stage_timings?: StageTimings;
	/** Error details (if status is 'failed') */
	error?: RunError;
	/** Progress info for batch runs */
	progress?: {
		current: number;
		total: number;
	};
}

/**
 * Batch run summary response
 */
export interface BatchRunResponse {
	/** Batch run identifier */
	batch_id: string;
	/** Total events in batch */
	total: number;
	/** Successfully processed events */
	successful: number;
	/** Failed events */
	failed: number;
	/** Average latency across all events */
	average_latency_ms: number;
	/** Individual run IDs */
	run_ids: string[];
	/** Timestamp of batch completion */
	timestamp: string;
}

/**
 * Component props for RunCommandPanel
 */
export interface RunCommandPanelProps {
	/** Callback when run is submitted */
	onRunSubmit?: (request: RunRequest | BatchRunRequest) => Promise<RunResponse | BatchRunResponse>;
	/** Callback when run status changes */
	onRunStatusChange?: (status: RunStatus, runId?: string) => void;
	/** Callback when debug flags change */
	onDebugFlagsChange?: (flags: DebugFlags) => void;
	/** Callback when batch progress updates */
	onBatchProgressUpdate?: (current: number, total: number) => void;
	/** Default auth token value */
	defaultAuthToken?: string;
	/** Default payload value */
	defaultPayload?: Record<string, unknown>;
	/** Component variant */
	variant?: 'default' | 'debug' | 'bulk';
	/** Disable the panel */
	disabled?: boolean;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Run mode type
 */
export type RunMode = 'default' | 'batch';

/**
 * Component internal state
 */
export interface RunCommandState {
	/** Current run mode */
	mode: RunMode;
	/** Run status */
	status: RunStatus;
	/** Current run ID */
	runId?: string;
	/** Last error */
	error?: RunError;
	/** Submission timestamp */
	submittedAt?: Date;
	/** Completion timestamp */
	completedAt?: Date;
	/** Batch progress */
	batchProgress?: {
		current: number;
		total: number;
	};
}

/**
 * Event Timeline Types (Story 7.3)
 */

/**
 * Stage status for Event Timeline
 */
export type StageStatus = 'idle' | 'active' | 'success' | 'error' | 'pending';

/**
 * Stage name enumeration
 */
export type StageName = 'ingress' | 'queue' | 'processing' | 'inbox';

/**
 * Stage timing data
 */
export interface StageTiming {
	start: string | null; // ISO8601 timestamp
	end: string | null; // ISO8601 timestamp
	duration_ms: number | null;
}

/**
 * Stage error details
 */
export interface StageError {
	code: string;
	message: string;
	log_snippet?: string;
}

/**
 * Stage state with status, timing, and error
 */
export interface StageState {
	status: StageStatus;
	timing: StageTiming;
	error?: StageError;
}

/**
 * Props for StageCard component
 */
export interface StageCardProps {
	/** Stage name (ingress, queue, processing, inbox) */
	stage: StageName;
	/** Current stage state */
	stageState: StageState;
	/** Whether this card is currently active */
	isActive: boolean;
	/** Whether user can interact with the card */
	isInteractive: boolean;
	/** Callback when log drawer is triggered */
	onViewLogs?: () => void;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Stage log entry
 */
export interface StageLogEntry {
	timestamp: string; // ISO8601
	level: 'info' | 'warn' | 'error';
	message: string;
	metadata?: Record<string, unknown>;
}

/**
 * Stage logs response from API
 */
export interface StageLogsResponse {
	stage: StageName;
	logs: StageLogEntry[];
	error_summary?: {
		code: string;
		message: string;
	};
	retry_eligible: boolean;
}

/**
 * Props for StageLogDrawer component
 */
export interface StageLogDrawerProps {
	/** Whether drawer is open */
	isOpen: boolean;
	/** Callback when drawer should close */
	onClose: () => void;
	/** Stage name for which logs are shown */
	stage: StageName;
	/** Run ID to fetch logs for */
	runId: string | null;
	/** Stage error (if any) */
	error?: StageError;
	/** Whether retry is eligible */
	retryEligible?: boolean;
	/** Callback when retry button clicked */
	onRetry?: () => void;
}

/**
 * Batch stage progress
 */
export interface BatchStageProgress {
	completed: number;
	in_progress: number;
	failed: number;
}

/**
 * Batch latency percentiles
 */
export interface BatchLatencyPercentiles {
	p50: number;
	p95: number;
	p99: number;
}

/**
 * Batch aggregation state
 */
export interface BatchState {
	batch_id: string | null;
	total_events: number;
	events_completed: number;
	events_failed: number;
	stage_progress: {
		ingress: BatchStageProgress;
		queue: BatchStageProgress;
		processing: BatchStageProgress;
		inbox: BatchStageProgress;
	};
	stage_latencies: {
		ingress_ms: BatchLatencyPercentiles;
		queue_ms: BatchLatencyPercentiles;
		processing_ms: BatchLatencyPercentiles;
	};
}

/**
 * Props for EventTimelineCanvas component
 */
export interface EventTimelineCanvasProps {
	/** Additional CSS classes */
	className?: string;
}

/**
 * WebSocket message types for stage updates
 */
export type WebSocketMessageType =
	| 'stage_transition'
	| 'stage_error'
	| 'stage_complete'
	| 'batch_progress'
	| 'run_complete';

/**
 * WebSocket message structure
 */
export interface WebSocketMessage {
	type: WebSocketMessageType;
	data: unknown;
}
