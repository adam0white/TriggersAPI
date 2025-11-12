/**
 * API client for run command endpoints
 * Story 7.2: Run Command Panel
 */

import type {
	RunRequest,
	BatchRunRequest,
	RunResponse,
	BatchRunResponse,
} from '@/types/runs';

/**
 * Base API URL - will be replaced with environment config in production
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

/**
 * Network error with retry capability
 */
export class NetworkError extends Error {
	constructor(
		message: string,
		public retryable: boolean = true
	) {
		super(message);
		this.name = 'NetworkError';
	}
}

/**
 * API error with status code and error details
 */
export class ApiError extends Error {
	constructor(
		message: string,
		public statusCode: number,
		public errorCode?: string,
		public details?: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

/**
 * Submit a default single-run event
 *
 * @param request - Run request with auth token, payload, and optional debug flags
 * @returns Promise resolving to run response with run ID and status
 * @throws {NetworkError} On network failure (connection timeout, DNS error)
 * @throws {ApiError} On API error (400/401/403/500 responses)
 */
export async function submitDefaultRun(
	request: RunRequest
): Promise<RunResponse> {
	try {
		// Convert run request to event format for backend
		const eventPayload = {
			event_type: 'ui.run.default',
			timestamp: new Date().toISOString(),
			source: 'ui-mission-control',
			data: request.payload,
			run_id: crypto.randomUUID(),
		};

		const response = await fetch(`${API_BASE_URL}/events`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${request.auth_token}`,
			},
			body: JSON.stringify({
				payload: eventPayload,
				metadata: {
					debug_flags: request.debug_flags,
					run_id: eventPayload.run_id,
				},
			}),
		});

		// Handle non-2xx responses
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({})) as any;
			const errorMessage =
				errorData?.error?.message || `Request failed with status ${response.status}`;
			const errorCode = errorData?.error?.code || `HTTP_${response.status}`;

			throw new ApiError(
				errorMessage,
				response.status,
				errorCode,
				errorData?.error?.details
			);
		}

		const data = await response.json();

		// Convert event response back to run response format
		return {
			run_id: eventPayload.run_id,
			status: 'success',
			timestamp: data.data?.timestamp || eventPayload.timestamp,
		} as RunResponse;
	} catch (error) {
		// Re-throw ApiError as-is
		if (error instanceof ApiError) {
			throw error;
		}

		// Network errors (connection timeout, DNS failure, etc.)
		if (error instanceof TypeError || error instanceof Error) {
			throw new NetworkError(
				`Network error: Unable to connect to server. ${error.message}`,
				true
			);
		}

		// Unknown error
		throw new NetworkError('Unknown error occurred', false);
	}
}

/**
 * Submit a batch run of multiple events
 *
 * @param request - Batch request with auth token, batch size, payload template, and optional debug flags
 * @returns Promise resolving to batch run response with summary statistics
 * @throws {NetworkError} On network failure
 * @throws {ApiError} On API error
 */
export async function submitBatchRun(
	request: BatchRunRequest
): Promise<BatchRunResponse> {
	// For batch runs, we submit multiple individual events
	const batchId = crypto.randomUUID();
	const results: Array<{ success: boolean; event_id?: string; error?: string }> = [];

	try {
		for (let i = 0; i < request.batch_size; i++) {
			// Add latency if requested
			if (request.inject_latency_ms) {
				await new Promise(resolve => setTimeout(resolve, request.inject_latency_ms));
			}

			const eventPayload = {
				event_type: 'ui.run.batch',
				timestamp: new Date().toISOString(),
				source: 'ui-mission-control',
				data: {
					...request.payload_template,
					batch_index: i,
				},
				batch_id: batchId,
			};

			try {
				const response = await fetch(`${API_BASE_URL}/events`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${request.auth_token}`,
					},
					body: JSON.stringify({
						payload: eventPayload,
						metadata: {
							debug_flags: request.debug_flags,
							batch_id: batchId,
							batch_index: i,
						},
					}),
				});

				if (response.ok) {
					const data = await response.json();
					results.push({
						success: true,
						event_id: data.data?.event_id,
					});
				} else {
					results.push({
						success: false,
						error: `Failed for index ${i}: ${response.status}`,
					});
				}
			} catch (err) {
				results.push({
					success: false,
					error: `Failed for index ${i}: ${err instanceof Error ? err.message : 'Unknown error'}`,
				});
			}
		}

		const successCount = results.filter(r => r.success).length;
		const failedCount = results.length - successCount;

		// Convert to batch response format
		return {
			batch_id: batchId,
			total: request.batch_size,
			successful: successCount,
			failed: failedCount,
			average_latency_ms: request.inject_latency_ms || 0,
			run_ids: results.filter(r => r.success && r.event_id).map(r => r.event_id!),
			timestamp: new Date().toISOString(),
		} as BatchRunResponse;
	} catch (error) {
		// Re-throw ApiError as-is
		if (error instanceof ApiError) {
			throw error;
		}

		// Network errors
		if (error instanceof TypeError || error instanceof Error) {
			throw new NetworkError(
				`Network error: Unable to connect to server. ${error.message}`,
				true
			);
		}

		// Unknown error
		throw new NetworkError('Unknown error occurred', false);
	}
}

/**
 * Fetch run status by run ID
 * Note: Since backend doesn't have a run status endpoint, we return a mock status
 *
 * @param runId - Unique run identifier
 * @param authToken - Authentication token
 * @returns Promise resolving to current run status
 * @throws {NetworkError} On network failure
 * @throws {ApiError} On API error
 */
export async function fetchRunStatus(
	runId: string,
	authToken: string
): Promise<RunResponse> {
	// Backend doesn't have a run status endpoint, return mock status
	// In a real implementation, this could query the inbox endpoint or a dedicated status endpoint
	return Promise.resolve({
		run_id: runId,
		status: 'success',
		timestamp: new Date().toISOString(),
	} as RunResponse);
}

/**
 * Create WebSocket connection for real-time run status updates
 *
 * @param authToken - Authentication token
 * @param onMessage - Callback for status update messages
 * @param onError - Callback for connection errors
 * @returns WebSocket instance
 */
export function createRunStatusWebSocket(
	authToken: string,
	onMessage: (data: RunResponse) => void,
	onError?: (error: Event) => void
): WebSocket {
	const wsUrl =
		import.meta.env.VITE_WS_URL || `ws://${window.location.host}/ws/runs`;
	const ws = new WebSocket(`${wsUrl}?token=${authToken}`);

	ws.onmessage = (event) => {
		try {
			const data = JSON.parse(event.data) as RunResponse;
			onMessage(data);
		} catch (error) {
			console.error('Failed to parse WebSocket message:', error);
		}
	};

	ws.onerror = (error) => {
		console.error('WebSocket error:', error);
		if (onError) {
			onError(error);
		}
	};

	return ws;
}
