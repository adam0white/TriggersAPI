/**
 * RunContext - Shared state management for run command panel and timeline
 * Story 7.2/7.3/7.5: Provides run state synchronization between components
 *
 * Exposes:
 * - Current run status and ID
 * - Stage-by-stage progress tracking
 * - Debug flags and batch mode state
 * - WebSocket connection status
 * - Event emitters for status changes
 * - Run history tracking (Story 7.5)
 * - Session metrics aggregation (Story 7.5)
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useMemo } from 'react';
import type { RunStatus, DebugFlags, StageStatus } from '@/types/runs';
import type { RunHistoryEntry, SessionMetrics } from '@/types/metrics';

/**
 * Stage timing information
 */
export interface StageTiming {
	start: string | null; // ISO8601 timestamp
	end: string | null; // ISO8601 timestamp
	duration_ms: number | null;
}

/**
 * Stage-level status with error tracking
 */
export interface StageState {
	status: 'idle' | 'active' | 'success' | 'error' | 'pending';
	timing: StageTiming;
	error?: {
		code: string;
		message: string;
		log_snippet?: string;
	};
}

/**
 * Run state containing all stage information
 */
export interface RunState {
	run_id: string | null;
	status: RunStatus;
	current_stage: 'ingress' | 'queue' | 'processing' | 'inbox' | null;
	stages: {
		ingress: StageState;
		queue: StageState;
		processing: StageState;
		inbox: StageState;
	};
	payload_summary?: string;
	request_id?: string;
	timestamp: string | null; // ISO8601 when run started
}

/**
 * Batch run state
 */
export interface BatchState {
	batch_id: string | null;
	total_events: number;
	events_completed: number;
	events_failed: number;
	stage_progress: {
		ingress: { completed: number; in_progress: number; failed: number };
		queue: { completed: number; in_progress: number; failed: number };
		processing: { completed: number; in_progress: number; failed: number };
		inbox: { completed: number; in_progress: number; failed: number };
	};
	stage_latencies: {
		ingress_ms: { p50: number; p95: number; p99: number };
		queue_ms: { p50: number; p95: number; p99: number };
		processing_ms: { p50: number; p95: number; p99: number };
	};
}

/**
 * RunContext value interface
 */
export interface RunContextValue {
	// Current run state
	runState: RunState;
	batchState: BatchState | null;
	isBatchMode: boolean;

	// Debug flags
	debugFlags: DebugFlags;

	// WebSocket connection status
	isConnected: boolean;
	connectionError: string | null;

	// History & Metrics (Story 7.5)
	runHistory: RunHistoryEntry[];
	sessionMetrics: SessionMetrics;

	// Actions
	startRun: (runId: string, payload?: any) => void;
	startBatchRun: (batchId: string, totalEvents: number) => void;
	updateStageStatus: (stage: keyof RunState['stages'], status: StageState) => void;
	updateBatchProgress: (progress: Partial<BatchState>) => void;
	setDebugFlags: (flags: DebugFlags) => void;
	resetRun: () => void;
	completeRun: (success: boolean, payload?: any) => void;

	// WebSocket subscription (for manual control)
	subscribeToRun: (runId: string) => void;
	unsubscribeFromRun: () => void;
}

const RunContext = createContext<RunContextValue | undefined>(undefined);

/**
 * Initial state for a single stage
 */
const initialStageState: StageState = {
	status: 'idle',
	timing: {
		start: null,
		end: null,
		duration_ms: null,
	},
};

/**
 * Initial run state
 */
const initialRunState: RunState = {
	run_id: null,
	status: 'idle',
	current_stage: null,
	stages: {
		ingress: { ...initialStageState },
		queue: { ...initialStageState },
		processing: { ...initialStageState },
		inbox: { ...initialStageState },
	},
	timestamp: null,
};

/**
 * RunContext Provider
 */
export function RunProvider({ children }: { children: ReactNode }) {
	const [runState, setRunState] = useState<RunState>(initialRunState);
	const [batchState, setBatchState] = useState<BatchState | null>(null);
	const [isBatchMode, setIsBatchMode] = useState(false);
	const [debugFlags, setDebugFlags] = useState<DebugFlags>({});
	const [isConnected, setIsConnected] = useState(false);
	const [connectionError, setConnectionError] = useState<string | null>(null);
	const [ws, setWs] = useState<WebSocket | null>(null);

	// Story 7.5: History tracking
	const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
	const [metricsHistory, setMetricsHistory] = useState<{
		eventsPerMinute: number[];
		successRateTrend: number[];
		latencyTrend: number[];
		queueDepthTrend: number[];
	}>({
		eventsPerMinute: [],
		successRateTrend: [],
		latencyTrend: [],
		queueDepthTrend: [],
	});

	/**
	 * Start a single run
	 */
	const startRun = useCallback((runId: string, payload?: any) => {
		setIsBatchMode(false);
		setBatchState(null);
		setRunState({
			run_id: runId,
			status: 'ingress',
			current_stage: 'ingress',
			stages: {
				ingress: { status: 'active', timing: { start: new Date().toISOString(), end: null, duration_ms: null } },
				queue: { ...initialStageState, status: 'pending' },
				processing: { ...initialStageState, status: 'pending' },
				inbox: { ...initialStageState, status: 'pending' },
			},
			payload_summary: payload ? JSON.stringify(payload).substring(0, 100) : undefined,
			timestamp: new Date().toISOString(),
		});
	}, []);

	/**
	 * Start a batch run
	 */
	const startBatchRun = useCallback((batchId: string, totalEvents: number) => {
		setIsBatchMode(true);
		setRunState({
			...initialRunState,
			run_id: batchId,
			status: 'ingress',
			current_stage: 'ingress',
			timestamp: new Date().toISOString(),
		});
		setBatchState({
			batch_id: batchId,
			total_events: totalEvents,
			events_completed: 0,
			events_failed: 0,
			stage_progress: {
				ingress: { completed: 0, in_progress: 0, failed: 0 },
				queue: { completed: 0, in_progress: 0, failed: 0 },
				processing: { completed: 0, in_progress: 0, failed: 0 },
				inbox: { completed: 0, in_progress: 0, failed: 0 },
			},
			stage_latencies: {
				ingress_ms: { p50: 0, p95: 0, p99: 0 },
				queue_ms: { p50: 0, p95: 0, p99: 0 },
				processing_ms: { p50: 0, p95: 0, p99: 0 },
			},
		});
	}, []);

	/**
	 * Update a specific stage's status
	 */
	const updateStageStatus = useCallback((stage: keyof RunState['stages'], stageState: StageState) => {
		setRunState((prev) => ({
			...prev,
			current_stage: stageState.status === 'active' ? stage : prev.current_stage,
			stages: {
				...prev.stages,
				[stage]: stageState,
			},
		}));
	}, []);

	/**
	 * Update batch progress
	 */
	const updateBatchProgress = useCallback((progress: Partial<BatchState>) => {
		setBatchState((prev) => {
			if (!prev) return null;
			return { ...prev, ...progress };
		});
	}, []);

	/**
	 * Complete a run and add to history (Story 7.5)
	 */
	const completeRun = useCallback((success: boolean, payload?: any) => {
		if (!runState.run_id) return;

		// Calculate run duration
		const startTime = runState.timestamp ? new Date(runState.timestamp).getTime() : Date.now();
		const duration = Date.now() - startTime;

		// Calculate average latency from stages
		const avgLatency = Object.values(runState.stages).reduce((sum, stage) => {
			return sum + (stage.timing.duration_ms || 0);
		}, 0) / 4;

		// Determine status
		let status: 'success' | 'failed' | 'partial' = success ? 'success' : 'failed';
		if (isBatchMode && batchState && batchState.events_failed > 0 && batchState.events_completed > 0) {
			status = 'partial';
		}

		// Determine type
		const type: 'default' | 'debug' | 'bulk' =
			isBatchMode ? 'bulk' :
			Object.keys(debugFlags).length > 0 ? 'debug' :
			'default';

		// Create history entry
		const historyEntry: RunHistoryEntry = {
			runId: runState.run_id,
			status,
			type,
			timestamp: new Date().toISOString(),
			avgLatency,
			eventCount: batchState?.total_events,
			failedCount: batchState?.events_failed,
			payload: payload || {},
			debugFlags: debugFlags as Record<string, unknown>,
			duration,
		};

		// Add to history (max 50 entries)
		setRunHistory(prev => [historyEntry, ...prev].slice(0, 50));

		// Update metrics trends (max 10 data points for sparklines)
		setMetricsHistory(prev => ({
			eventsPerMinute: [...prev.eventsPerMinute, batchState?.total_events || 1].slice(-10),
			successRateTrend: [...prev.successRateTrend, status === 'success' ? 100 : status === 'partial' ? 50 : 0].slice(-10),
			latencyTrend: [...prev.latencyTrend, avgLatency].slice(-10),
			queueDepthTrend: [...prev.queueDepthTrend, 0].slice(-10), // Queue depth would come from API
		}));
	}, [runState, batchState, isBatchMode, debugFlags]);

	/**
	 * Reset run state
	 */
	const resetRun = useCallback(() => {
		setRunState(initialRunState);
		setBatchState(null);
		setIsBatchMode(false);
		if (ws) {
			ws.close();
			setWs(null);
		}
	}, [ws]);

	/**
	 * Subscribe to WebSocket for run updates
	 */
	const subscribeToRun = useCallback((runId: string) => {
		// Close existing connection
		if (ws) {
			ws.close();
		}

		try {
			// For now, we'll use mock WebSocket endpoint
			// In production, this would be: wss://api.example.com/ws/runs/${runId}
			const wsUrl = `ws://localhost:8787/ws/runs/${runId}`;
			const newWs = new WebSocket(wsUrl);

			newWs.onopen = () => {
				setIsConnected(true);
				setConnectionError(null);
				console.log('[RunContext] WebSocket connected:', runId);
			};

			newWs.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);
					handleWebSocketMessage(message);
				} catch (error) {
					console.error('[RunContext] Failed to parse WebSocket message:', error);
				}
			};

			newWs.onerror = (error) => {
				console.error('[RunContext] WebSocket error:', error);
				setConnectionError('WebSocket connection failed');
				setIsConnected(false);
			};

			newWs.onclose = () => {
				console.log('[RunContext] WebSocket closed');
				setIsConnected(false);
			};

			setWs(newWs);
		} catch (error) {
			console.error('[RunContext] Failed to create WebSocket:', error);
			setConnectionError('Failed to create WebSocket connection');
		}
	}, [ws]);

	/**
	 * Unsubscribe from WebSocket
	 */
	const unsubscribeFromRun = useCallback(() => {
		if (ws) {
			ws.close();
			setWs(null);
			setIsConnected(false);
		}
	}, [ws]);

	/**
	 * Handle WebSocket messages
	 */
	const handleWebSocketMessage = useCallback((message: any) => {
		const { type, data } = message;

		switch (type) {
			case 'stage_transition':
				// Update stage status when a stage completes and next one starts
				if (data.previous_stage) {
					updateStageStatus(data.previous_stage, {
						status: 'success',
						timing: data.previous_timing || { start: null, end: new Date().toISOString(), duration_ms: data.duration_ms },
					});
				}
				if (data.current_stage) {
					updateStageStatus(data.current_stage, {
						status: 'active',
						timing: { start: new Date().toISOString(), end: null, duration_ms: null },
					});
				}
				break;

			case 'stage_error':
				// Update stage to error state
				updateStageStatus(data.stage, {
					status: 'error',
					timing: data.timing || { start: null, end: new Date().toISOString(), duration_ms: data.duration_ms },
					error: {
						code: data.error_code,
						message: data.error_message,
						log_snippet: data.log_snippet,
					},
				});
				break;

			case 'stage_complete':
				// Mark stage as complete
				updateStageStatus(data.stage, {
					status: 'success',
					timing: data.timing || { start: null, end: new Date().toISOString(), duration_ms: data.duration_ms },
				});
				break;

			case 'batch_progress':
				// Update batch progress
				updateBatchProgress({
					events_completed: data.events_completed,
					events_failed: data.events_failed,
					stage_progress: data.stage_progress,
					stage_latencies: data.stage_latencies,
				});
				break;

			case 'run_complete':
				// Mark entire run as complete
				setRunState((prev) => ({
					...prev,
					status: data.success ? 'success' : 'failed',
				}));
				break;

			default:
				console.warn('[RunContext] Unknown WebSocket message type:', type);
		}
	}, [updateStageStatus, updateBatchProgress]);

	/**
	 * Cleanup WebSocket on unmount
	 */
	useEffect(() => {
		return () => {
			if (ws) {
				ws.close();
			}
		};
	}, [ws]);

	/**
	 * Compute session metrics from run history (Story 7.5)
	 */
	const sessionMetrics = useMemo<SessionMetrics>(() => {
		if (runHistory.length === 0) {
			return {
				totalEvents: 0,
				successRate: 0,
				successfulEvents: 0,
				failedEvents: 0,
				avgLatency: 0,
				latencyPercentiles: { p50: 0, p95: 0, p99: 0 },
				queueDepth: 0,
				dlqCount: 0,
				eventsPerMinute: metricsHistory.eventsPerMinute,
				successRateTrend: metricsHistory.successRateTrend,
				latencyTrend: metricsHistory.latencyTrend,
				queueDepthTrend: metricsHistory.queueDepthTrend,
				timestamp: new Date().toISOString(),
			};
		}

		// Calculate aggregates from history
		const totalEvents = runHistory.reduce((sum, run) => sum + (run.eventCount || 1), 0);
		const failedEvents = runHistory.reduce((sum, run) => sum + (run.failedCount || (run.status === 'failed' ? 1 : 0)), 0);
		const successfulEvents = totalEvents - failedEvents;
		const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;

		// Calculate latency statistics
		const latencies = runHistory.map(run => run.avgLatency).sort((a, b) => a - b);
		const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
		const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
		const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
		const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

		return {
			totalEvents,
			successRate,
			successfulEvents,
			failedEvents,
			avgLatency,
			latencyPercentiles: { p50, p95, p99 },
			queueDepth: 0, // Would come from WebSocket/API
			dlqCount: failedEvents, // Simplified: assume all failures go to DLQ
			eventsPerMinute: metricsHistory.eventsPerMinute,
			successRateTrend: metricsHistory.successRateTrend,
			latencyTrend: metricsHistory.latencyTrend,
			queueDepthTrend: metricsHistory.queueDepthTrend,
			timestamp: new Date().toISOString(),
		};
	}, [runHistory, metricsHistory]);

	const value: RunContextValue = {
		runState,
		batchState,
		isBatchMode,
		debugFlags,
		isConnected,
		connectionError,
		runHistory,
		sessionMetrics,
		startRun,
		startBatchRun,
		updateStageStatus,
		updateBatchProgress,
		setDebugFlags,
		resetRun,
		completeRun,
		subscribeToRun,
		unsubscribeFromRun,
	};

	return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

/**
 * Hook to access RunContext
 */
export function useRun() {
	const context = useContext(RunContext);
	if (context === undefined) {
		throw new Error('useRun must be used within a RunProvider');
	}
	return context;
}
