/**
 * Custom hook for managing run command submission logic
 * Story 7.2: Run Command Panel
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { submitDefaultRun, submitBatchRun, ApiError, NetworkError } from '@/services/runsApi';
import type {
	RunRequest,
	BatchRunRequest,
	RunResponse,
	BatchRunResponse,
	RunStatus,
	RunError,
	DebugFlags,
	RunMode,
} from '@/types/runs';

/**
 * Hook configuration
 */
interface UseRunCommandConfig {
	/** Callback when run status changes */
	onStatusChange?: (status: RunStatus, runId?: string) => void;
	/** Callback when batch progress updates */
	onBatchProgress?: (current: number, total: number) => void;
	/** Maximum retry attempts for network errors */
	maxRetries?: number;
	/** Auto-retry delay in milliseconds */
	retryDelay?: number;
}

/**
 * Hook return value
 */
interface UseRunCommandReturn {
	/** Current run status */
	status: RunStatus;
	/** Current run ID (if available) */
	runId: string | null;
	/** Last error (if any) */
	error: RunError | null;
	/** Submission timestamp */
	submittedAt: Date | null;
	/** Completion timestamp */
	completedAt: Date | null;
	/** Batch progress (if in batch mode) */
	batchProgress: { current: number; total: number } | null;
	/** Current retry attempt (0 if not retrying) */
	retryAttempt: number;
	/** Submit a default run */
	submitRun: (
		authToken: string,
		payload: Record<string, unknown>,
		debugFlags?: DebugFlags
	) => Promise<void>;
	/** Submit a batch run */
	submitBatchRun: (
		authToken: string,
		batchSize: number,
		payloadTemplate: Record<string, unknown>,
		debugFlags?: DebugFlags,
		injectLatencyMs?: number
	) => Promise<void>;
	/** Reset the run state */
	reset: () => void;
	/** Manually retry failed run */
	retry: () => Promise<void>;
}

/**
 * Custom hook for managing run command submissions with auto-retry logic
 *
 * @param config - Hook configuration
 * @returns Run command state and actions
 *
 * @example
 * ```tsx
 * const { status, submitRun, error } = useRunCommand({
 *   onStatusChange: (status, runId) => console.log('Status:', status, runId),
 *   maxRetries: 3,
 *   retryDelay: 1000,
 * });
 *
 * // Submit default run
 * await submitRun(authToken, payload, { trigger_validation_error: true });
 * ```
 */
export function useRunCommand(config: UseRunCommandConfig = {}): UseRunCommandReturn {
	const { onStatusChange, onBatchProgress, maxRetries = 3, retryDelay = 1000 } = config;

	// State
	const [status, setStatus] = useState<RunStatus>('idle');
	const [runId, setRunId] = useState<string | null>(null);
	const [error, setError] = useState<RunError | null>(null);
	const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
	const [completedAt, setCompletedAt] = useState<Date | null>(null);
	const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
		null
	);
	const [retryAttempt, setRetryAttempt] = useState(0);

	// Refs to store last request for retry
	const lastRequestRef = useRef<{
		type: 'default' | 'batch';
		request: RunRequest | BatchRunRequest;
	} | null>(null);

	/**
	 * Update status and notify listeners
	 */
	const updateStatus = useCallback(
		(newStatus: RunStatus, newRunId?: string) => {
			setStatus(newStatus);
			if (newRunId) {
				setRunId(newRunId);
			}
			if (onStatusChange) {
				onStatusChange(newStatus, newRunId || runId || undefined);
			}
		},
		[onStatusChange, runId]
	);

	/**
	 * Handle successful run response
	 */
	const handleSuccess = useCallback(
		(response: RunResponse | BatchRunResponse) => {
			const now = new Date();
			setCompletedAt(now);

			// Batch run response
			if ('batch_id' in response) {
				updateStatus('success', response.batch_id);
				setBatchProgress({
					current: response.successful,
					total: response.total,
				});
				if (onBatchProgress) {
					onBatchProgress(response.successful, response.total);
				}
			} else {
				// Single run response
				updateStatus(response.status === 'failed' ? 'failed' : 'success', response.run_id);
				if (response.error) {
					setError(response.error);
				}
			}

			setRetryAttempt(0);
		},
		[updateStatus, onBatchProgress]
	);

	/**
	 * Handle API or network error with auto-retry logic
	 */
	const handleError = useCallback(
		async (err: unknown, attempt: number): Promise<void> => {
			console.error('Run submission error:', err);

			if (err instanceof NetworkError && err.retryable && attempt < maxRetries) {
				// Auto-retry for network errors
				setRetryAttempt(attempt + 1);
				updateStatus('retry');

				// Exponential backoff: 1s, 2s, 4s
				const delay = retryDelay * Math.pow(2, attempt);
				await new Promise((resolve) => setTimeout(resolve, delay));

				// Retry the last request
				if (lastRequestRef.current) {
					if (lastRequestRef.current.type === 'default') {
						const req = lastRequestRef.current.request as RunRequest;
						return handleSubmitRun(req, attempt + 1);
					} else {
						const req = lastRequestRef.current.request as BatchRunRequest;
						return handleSubmitBatchRun(req, attempt + 1);
					}
				}
			} else {
				// API error or max retries exceeded
				updateStatus('failed');
				setCompletedAt(new Date());

				if (err instanceof ApiError) {
					setError({
						code: err.errorCode || `HTTP_${err.statusCode}`,
						message: err.message,
						details: err.details,
					});
				} else if (err instanceof NetworkError) {
					setError({
						code: 'NETWORK_ERROR',
						message: err.message,
					});
				} else {
					setError({
						code: 'UNKNOWN_ERROR',
						message: 'An unknown error occurred',
					});
				}

				setRetryAttempt(0);
			}
		},
		[maxRetries, retryDelay, updateStatus]
	);

	/**
	 * Internal handler for default run submission
	 */
	const handleSubmitRun = useCallback(
		async (request: RunRequest, attempt: number = 0): Promise<void> => {
			try {
				updateStatus('submitting');
				const response = await submitDefaultRun(request);
				handleSuccess(response);
			} catch (err) {
				await handleError(err, attempt);
			}
		},
		[updateStatus, handleSuccess, handleError]
	);

	/**
	 * Internal handler for batch run submission
	 */
	const handleSubmitBatchRun = useCallback(
		async (request: BatchRunRequest, attempt: number = 0): Promise<void> => {
			try {
				updateStatus('submitting');
				const response = await submitBatchRun(request);
				handleSuccess(response);
			} catch (err) {
				await handleError(err, attempt);
			}
		},
		[updateStatus, handleSuccess, handleError]
	);

	/**
	 * Submit a default single-run event
	 */
	const submitRun = useCallback(
		async (
			authToken: string,
			payload: Record<string, unknown>,
			debugFlags?: DebugFlags
		): Promise<void> => {
			const request: RunRequest = {
				auth_token: authToken,
				payload,
				debug_flags: debugFlags,
			};

			lastRequestRef.current = { type: 'default', request };
			setSubmittedAt(new Date());
			setError(null);
			setCompletedAt(null);
			setBatchProgress(null);

			await handleSubmitRun(request, 0);
		},
		[handleSubmitRun]
	);

	/**
	 * Submit a batch run of multiple events
	 */
	const submitBatch = useCallback(
		async (
			authToken: string,
			batchSize: number,
			payloadTemplate: Record<string, unknown>,
			debugFlags?: DebugFlags,
			injectLatencyMs?: number
		): Promise<void> => {
			const request: BatchRunRequest = {
				auth_token: authToken,
				batch_size: batchSize,
				payload_template: payloadTemplate,
				debug_flags: debugFlags,
				inject_latency_ms: injectLatencyMs,
			};

			lastRequestRef.current = { type: 'batch', request };
			setSubmittedAt(new Date());
			setError(null);
			setCompletedAt(null);
			setBatchProgress({
				current: 0,
				total: batchSize,
			});

			await handleSubmitBatchRun(request, 0);
		},
		[handleSubmitBatchRun]
	);

	/**
	 * Reset run state
	 */
	const reset = useCallback(() => {
		setStatus('idle');
		setRunId(null);
		setError(null);
		setSubmittedAt(null);
		setCompletedAt(null);
		setBatchProgress(null);
		setRetryAttempt(0);
		lastRequestRef.current = null;
	}, []);

	/**
	 * Manually retry the last failed run
	 */
	const retry = useCallback(async (): Promise<void> => {
		if (!lastRequestRef.current) {
			console.warn('No previous request to retry');
			return;
		}

		setError(null);
		setRetryAttempt(0);

		if (lastRequestRef.current.type === 'default') {
			await handleSubmitRun(lastRequestRef.current.request as RunRequest, 0);
		} else {
			await handleSubmitBatchRun(lastRequestRef.current.request as BatchRunRequest, 0);
		}
	}, [handleSubmitRun, handleSubmitBatchRun]);

	/**
	 * Auto-reset success state after 3 seconds
	 */
	useEffect(() => {
		if (status === 'success') {
			const timer = setTimeout(() => {
				setStatus('idle');
				setCompletedAt(null);
			}, 3000);

			return () => clearTimeout(timer);
		}
	}, [status]);

	return {
		status,
		runId,
		error,
		submittedAt,
		completedAt,
		batchProgress,
		retryAttempt,
		submitRun,
		submitBatchRun: submitBatch,
		reset,
		retry,
	};
}
