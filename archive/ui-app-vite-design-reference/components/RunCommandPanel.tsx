/**
 * Run Command Panel - Hero Interaction Component
 * Story 7.2: Run Command Panel
 *
 * Primary control surface for the Mission-Control Pulse dashboard.
 * Enables one-click default event submission, debug flag toggles,
 * batch controls, and real-time status messaging.
 *
 * @see Story 7.2 acceptance criteria for full feature list
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useRunCommand } from '@/hooks/useRunCommand';
import { useRun } from '@/context/RunContext';
import type { RunCommandPanelProps, DebugFlags } from '@/types/runs';

/**
 * Default payload for event submission
 */
const DEFAULT_PAYLOAD = {
	event: 'order.created',
	data: {
		order_id: 'ord_demo_12345',
		amount: 99.99,
		currency: 'USD',
		customer_id: 'cust_demo_67890',
	},
	timestamp: new Date().toISOString(),
};

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date | null): string {
	if (!date) return '';

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSec = Math.floor(diffMs / 1000);

	if (diffSec < 5) return 'just now';
	if (diffSec < 60) return `${diffSec}s ago`;

	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;

	const diffHour = Math.floor(diffMin / 60);
	return `${diffHour}h ago`;
}

/**
 * Format elapsed time in milliseconds
 */
function formatElapsedTime(start: Date | null, end: Date | null): string {
	if (!start) return '';
	const endTime = end || new Date();
	const elapsedMs = endTime.getTime() - start.getTime();

	if (elapsedMs < 1000) return `${elapsedMs}ms`;
	return `${(elapsedMs / 1000).toFixed(2)}s`;
}

/**
 * Icons (simple SVG components)
 */
const CheckIcon = () => (
	<svg
		className="w-5 h-5"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
		aria-hidden="true"
	>
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
	</svg>
);

const ErrorIcon = () => (
	<svg
		className="w-5 h-5"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
		aria-hidden="true"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
		/>
	</svg>
);

const SpinnerIcon = () => (
	<svg
		className="w-5 h-5 animate-spin"
		fill="none"
		viewBox="0 0 24 24"
		aria-hidden="true"
	>
		<circle
			className="opacity-25"
			cx="12"
			cy="12"
			r="10"
			stroke="currentColor"
			strokeWidth="4"
		/>
		<path
			className="opacity-75"
			fill="currentColor"
			d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
		/>
	</svg>
);

const EyeIcon = () => (
	<svg
		className="w-4 h-4"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
		aria-hidden="true"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
		/>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
		/>
	</svg>
);

const EyeOffIcon = () => (
	<svg
		className="w-4 h-4"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
		aria-hidden="true"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
		/>
	</svg>
);

const ChevronDownIcon = () => (
	<svg
		className="w-4 h-4 transition-transform duration-200"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
		aria-hidden="true"
	>
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
	</svg>
);

/**
 * Run Command Panel Component
 */
export function RunCommandPanel({
	onRunSubmit,
	onRunStatusChange,
	onDebugFlagsChange,
	onBatchProgressUpdate,
	defaultAuthToken = '',
	defaultPayload = DEFAULT_PAYLOAD,
	variant = 'default',
	disabled = false,
	className,
}: RunCommandPanelProps) {
	// Run mode state (default or batch)
	const [runMode, setRunMode] = useState<'default' | 'batch'>(
		variant === 'bulk' ? 'batch' : 'default'
	);

	// Form state
	const [authToken, setAuthToken] = useState(defaultAuthToken);
	const [showToken, setShowToken] = useState(false);
	const [payload, setPayload] = useState(JSON.stringify(defaultPayload, null, 2));
	const [payloadError, setPayloadError] = useState<string | null>(null);

	// Debug flags state
	const [debugFlags, setDebugFlags] = useState<DebugFlags>({
		trigger_validation_error: false,
		trigger_processing_error: false,
		inject_latency_ms: 0,
	});

	// Batch mode state
	const [batchSize, setBatchSize] = useState(25);
	const [batchLatency, setBatchLatency] = useState(0);

	// Run command hook
	const {
		status,
		runId,
		error: runError,
		submittedAt,
		completedAt,
		batchProgress,
		retryAttempt,
		submitRun,
		submitBatchRun,
		retry,
	} = useRunCommand({
		onStatusChange: onRunStatusChange,
		onBatchProgress: onBatchProgressUpdate,
		maxRetries: 3,
		retryDelay: 1000,
	});

	// Story 7.3: Integration with RunContext for timeline synchronization
	const runContext = useRun();

	/**
	 * Sync run state with RunContext when run starts or updates
	 */
	useEffect(() => {
		if (runId && status === 'submitting') {
			const parsedPayload = payload ? JSON.parse(payload) : {};
			if (runMode === 'batch') {
				runContext.startBatchRun(runId, batchSize);
				// Simulate batch progression
				simulateBatchProgression(runContext, batchSize);
			} else {
				runContext.startRun(runId, parsedPayload);
				// Simulate single run progression
				simulateRunProgression(runContext);
			}
		}

		// Handle completion - update history and metrics
		if (runId && (status === 'success' || status === 'failed')) {
			const parsedPayload = payload ? JSON.parse(payload) : {};
			runContext.completeRun(status === 'success', parsedPayload);
		}
	}, [runId, status, runMode, batchSize]); // eslint-disable-line react-hooks/exhaustive-deps

	/**
	 * Simulate single run progression through stages
	 */
	const simulateRunProgression = (context: typeof runContext) => {
		// Stage 1: Ingress -> Queue (300ms)
		setTimeout(() => {
			context.updateStageStatus('ingress', {
				status: 'success',
				timing: {
					start: new Date(Date.now() - 200).toISOString(),
					end: new Date().toISOString(),
					duration_ms: 200
				}
			});
			context.updateStageStatus('queue', {
				status: 'active',
				timing: { start: new Date().toISOString(), end: null, duration_ms: null }
			});
		}, 300);

		// Stage 2: Queue -> Processing (800ms)
		setTimeout(() => {
			context.updateStageStatus('queue', {
				status: 'success',
				timing: {
					start: new Date(Date.now() - 500).toISOString(),
					end: new Date().toISOString(),
					duration_ms: 300
				}
			});
			context.updateStageStatus('processing', {
				status: 'active',
				timing: { start: new Date().toISOString(), end: null, duration_ms: null }
			});
		}, 800);

		// Stage 3: Processing -> Inbox (1400ms)
		setTimeout(() => {
			context.updateStageStatus('processing', {
				status: 'success',
				timing: {
					start: new Date(Date.now() - 900).toISOString(),
					end: new Date().toISOString(),
					duration_ms: 400
				}
			});
			context.updateStageStatus('inbox', {
				status: 'active',
				timing: { start: new Date().toISOString(), end: null, duration_ms: null }
			});
		}, 1400);

		// Stage 4: Inbox complete (1800ms)
		setTimeout(() => {
			context.updateStageStatus('inbox', {
				status: 'success',
				timing: {
					start: new Date(Date.now() - 1200).toISOString(),
					end: new Date().toISOString(),
					duration_ms: 200
				}
			});
		}, 1800);
	};

	/**
	 * Simulate batch run progression
	 */
	const simulateBatchProgression = (context: typeof runContext, totalEvents: number) => {
		const stages = ['ingress', 'queue', 'processing', 'inbox'];
		const timings = [300, 800, 1400, 1800];

		stages.forEach((stage, index) => {
			setTimeout(() => {
				const progress = (index + 1) / stages.length;
				const completed = Math.floor(totalEvents * progress);

				// Update previous stage to success
				if (index > 0) {
					context.updateStageStatus(stages[index - 1] as any, {
						status: 'success',
						timing: {
							start: new Date(Date.now() - 400).toISOString(),
							end: new Date().toISOString(),
							duration_ms: 400
						}
					});
				}

				// Update current stage to active
				if (index < stages.length - 1) {
					context.updateStageStatus(stage as any, {
						status: 'active',
						timing: { start: new Date().toISOString(), end: null, duration_ms: null }
					});
				} else {
					// Final stage - mark as success
					context.updateStageStatus(stage as any, {
						status: 'success',
						timing: {
							start: new Date(Date.now() - 200).toISOString(),
							end: new Date().toISOString(),
							duration_ms: 200
						}
					});
				}

				// Update batch progress
				context.updateBatchProgress({
					events_completed: completed,
					events_failed: 0,
					stage_progress: {
						ingress: { completed: index >= 0 ? totalEvents : 0, in_progress: 0, failed: 0 },
						queue: { completed: index >= 1 ? totalEvents : 0, in_progress: index === 1 ? totalEvents : 0, failed: 0 },
						processing: { completed: index >= 2 ? totalEvents : 0, in_progress: index === 2 ? totalEvents : 0, failed: 0 },
						inbox: { completed: index >= 3 ? totalEvents : 0, in_progress: index === 3 ? totalEvents : 0, failed: 0 },
					}
				});
			}, timings[index]);
		});
	};

	/**
	 * Sync debug flags with RunContext
	 */
	useEffect(() => {
		runContext.setDebugFlags(debugFlags);
	}, [debugFlags]); // eslint-disable-line react-hooks/exhaustive-deps

	/**
	 * Validate JSON payload
	 */
	const validatePayload = useCallback((jsonString: string): boolean => {
		try {
			JSON.parse(jsonString);
			setPayloadError(null);
			return true;
		} catch (err) {
			setPayloadError('Invalid JSON payload');
			return false;
		}
	}, []);

	/**
	 * Handle payload change with debounced validation
	 */
	const handlePayloadChange = useCallback(
		(value: string) => {
			setPayload(value);
			// Debounce validation
			const timer = setTimeout(() => {
				validatePayload(value);
			}, 500);
			return () => clearTimeout(timer);
		},
		[validatePayload]
	);

	/**
	 * Handle debug flag toggle
	 */
	const handleDebugFlagToggle = useCallback(
		(flag: keyof DebugFlags, value: boolean | number) => {
			const newFlags = { ...debugFlags, [flag]: value };
			setDebugFlags(newFlags);
			if (onDebugFlagsChange) {
				onDebugFlagsChange(newFlags);
			}
		},
		[debugFlags, onDebugFlagsChange]
	);

	/**
	 * Handle run submission
	 */
	const handleSubmit = useCallback(async () => {
		// Validate auth token
		if (!authToken.trim()) {
			return;
		}

		// Validate payload
		if (!validatePayload(payload)) {
			return;
		}

		const parsedPayload = JSON.parse(payload);

		// Submit based on mode
		if (runMode === 'batch') {
			await submitBatchRun(authToken, batchSize, parsedPayload, debugFlags, batchLatency);
		} else {
			await submitRun(authToken, parsedPayload, debugFlags);
		}

		// Call custom submit handler if provided
		if (onRunSubmit) {
			if (runMode === 'batch') {
				await onRunSubmit({
					auth_token: authToken,
					batch_size: batchSize,
					payload_template: parsedPayload,
					debug_flags: debugFlags,
					inject_latency_ms: batchLatency,
				});
			} else {
				await onRunSubmit({
					auth_token: authToken,
					payload: parsedPayload,
					debug_flags: debugFlags,
				});
			}
		}
	}, [
		authToken,
		payload,
		runMode,
		batchSize,
		batchLatency,
		debugFlags,
		validatePayload,
		submitRun,
		submitBatchRun,
		onRunSubmit,
	]);

	/**
	 * Count active debug flags
	 */
	const activeDebugFlagsCount = useMemo(() => {
		let count = 0;
		if (debugFlags.trigger_validation_error) count++;
		if (debugFlags.trigger_processing_error) count++;
		if (debugFlags.inject_latency_ms && debugFlags.inject_latency_ms > 0) count++;
		return count;
	}, [debugFlags]);

	/**
	 * Determine button state and content
	 */
	const buttonState = useMemo(() => {
		if (status === 'submitting' || status === 'retry') {
			return {
				variant: 'default' as const,
				disabled: true,
				icon: <SpinnerIcon />,
				text: status === 'retry' ? `Retrying (${retryAttempt}/3)...` : 'Running...',
				className: 'animate-pulse-opacity',
			};
		}

		if (status === 'success') {
			return {
				variant: 'success' as const,
				disabled: false,
				icon: <CheckIcon />,
				text: 'Success',
				className: '',
			};
		}

		if (status === 'failed') {
			return {
				variant: 'error' as const,
				disabled: false,
				icon: <ErrorIcon />,
				text: 'Failed - Retry?',
				className: 'animate-shake',
			};
		}

		// Idle state
		const isDisabled =
			disabled || !authToken.trim() || !!payloadError || status === 'submitting';
		return {
			variant: 'default' as const,
			disabled: isDisabled,
			icon: null,
			text: runMode === 'batch' ? 'Run Bulk Event' : 'Run Default Event',
			className: '',
		};
	}, [status, retryAttempt, disabled, authToken, payloadError, runMode]);

	/**
	 * Format JSON on demand
	 */
	const formatJSON = useCallback(() => {
		try {
			const parsed = JSON.parse(payload);
			const formatted = JSON.stringify(parsed, null, 2);
			setPayload(formatted);
			setPayloadError(null);
		} catch (err) {
			// Already invalid, leave as-is
		}
	}, [payload]);

	return (
		<section
			className={cn(
				// Card styling
				'card-base',
				// Layout
				'flex flex-col',
				// Spacing
				'p-xl gap-lg',
				className
			)}
			role="region"
			aria-labelledby="run-command-title"
			aria-live="polite"
		>
			{/* Header */}
			<div>
				<h2 id="run-command-title" className="text-h2 text-neutral-100 font-headline">
					Run Command
				</h2>
				<p className="text-caption text-neutral-400 mt-sm">
					Fire events and watch them traverse the stack with real-time status updates
				</p>
			</div>

			{/* Run Mode Tabs */}
			<Tabs.Root
				value={runMode}
				onValueChange={(value) => setRunMode(value as 'default' | 'batch')}
				className="w-full"
			>
				<Tabs.List
					className="inline-flex h-10 items-center justify-center rounded-md bg-surface p-1 text-neutral-400"
					aria-label="Run mode selection"
				>
					<Tabs.Trigger
						value="default"
						className={cn(
							'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-lg py-sm text-sm font-medium ring-offset-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
							runMode === 'default'
								? 'bg-surface-elevated text-neutral-100 shadow-sm'
								: 'text-neutral-400 hover:text-neutral-100'
						)}
					>
						Default Run
					</Tabs.Trigger>
					<Tabs.Trigger
						value="batch"
						className={cn(
							'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-lg py-sm text-sm font-medium ring-offset-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
							runMode === 'batch'
								? 'bg-surface-elevated text-neutral-100 shadow-sm'
								: 'text-neutral-400 hover:text-neutral-100'
						)}
					>
						Bulk Run
					</Tabs.Trigger>
				</Tabs.List>

				{/* Default Run Tab Content */}
				<Tabs.Content value="default" className="mt-lg space-y-lg">
					{/* Auth Token Input */}
					<div className="space-y-sm">
						<div className="flex items-center gap-sm">
							<Label htmlFor="auth-token" className="flex items-center gap-1">
								Auth Token
								<span className="text-primary" aria-label="required">
									*
								</span>
							</Label>
						</div>
						<div className="relative">
							<Input
								id="auth-token"
								type={showToken ? 'text' : 'password'}
								value={authToken}
								onChange={(e) => setAuthToken(e.target.value)}
								placeholder="Enter authentication token"
								aria-required="true"
								aria-invalid={!authToken.trim()}
								aria-describedby="auth-token-help"
								className="pr-12"
							/>
							<button
								type="button"
								onClick={() => setShowToken(!showToken)}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-100 transition-colors"
								aria-label={showToken ? 'Hide token' : 'Show token'}
							>
								{showToken ? <EyeOffIcon /> : <EyeIcon />}
							</button>
						</div>
						<p id="auth-token-help" className="text-xs text-neutral-400">
							Required to authorize event submission
						</p>
					</div>

					{/* Payload Editor */}
					<div className="space-y-sm">
						<div className="flex items-center justify-between">
							<Label htmlFor="payload-editor">Event Payload</Label>
							<button
								type="button"
								onClick={formatJSON}
								className="text-xs text-primary hover:underline"
								aria-label="Format JSON"
							>
								Format JSON
							</button>
						</div>
						<Textarea
							id="payload-editor"
							value={payload}
							onChange={(e) => handlePayloadChange(e.target.value)}
							placeholder='{"event": "order.created", "data": {...}}'
							aria-label="Event Payload Editor"
							aria-invalid={!!payloadError}
							aria-describedby={payloadError ? 'payload-error' : undefined}
							className={cn(payloadError && 'border-alert-error')}
						/>
						{payloadError && (
							<p id="payload-error" className="text-xs text-alert-error" role="alert">
								{payloadError}
							</p>
						)}
					</div>
				</Tabs.Content>

				{/* Batch Run Tab Content */}
				<Tabs.Content value="batch" className="mt-lg space-y-lg">
					{/* Auth Token (same as default) */}
					<div className="space-y-sm">
						<div className="flex items-center gap-sm">
							<Label htmlFor="auth-token-batch" className="flex items-center gap-1">
								Auth Token
								<span className="text-primary" aria-label="required">
									*
								</span>
							</Label>
						</div>
						<div className="relative">
							<Input
								id="auth-token-batch"
								type={showToken ? 'text' : 'password'}
								value={authToken}
								onChange={(e) => setAuthToken(e.target.value)}
								placeholder="Enter authentication token"
								aria-required="true"
								aria-invalid={!authToken.trim()}
								className="pr-12"
							/>
							<button
								type="button"
								onClick={() => setShowToken(!showToken)}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-100 transition-colors"
								aria-label={showToken ? 'Hide token' : 'Show token'}
							>
								{showToken ? <EyeOffIcon /> : <EyeIcon />}
							</button>
						</div>
					</div>

					{/* Batch Size Slider */}
					<div className="space-y-sm">
						<div className="flex items-center justify-between">
							<Label htmlFor="batch-size-slider">Batch Size</Label>
							<span className="text-sm font-medium text-neutral-100">{batchSize} events</span>
						</div>
						<Slider
							id="batch-size-slider"
							min={5}
							max={100}
							step={5}
							value={[batchSize]}
							onValueChange={([value]) => setBatchSize(value)}
							aria-label={`Batch size, currently ${batchSize} events`}
							className="w-full"
						/>
					</div>

					{/* Batch Latency Injection */}
					<div className="space-y-sm">
						<div className="flex items-center justify-between">
							<Label htmlFor="batch-latency-slider">Inject Latency (ms)</Label>
							<span className="text-sm font-medium text-neutral-100">
								{batchLatency}ms
							</span>
						</div>
						<Slider
							id="batch-latency-slider"
							min={0}
							max={5000}
							step={100}
							value={[batchLatency]}
							onValueChange={([value]) => setBatchLatency(value)}
							aria-label={`Inject latency, currently ${batchLatency} milliseconds`}
							className="w-full"
						/>
					</div>

					{/* Payload Template */}
					<div className="space-y-sm">
						<div className="flex items-center justify-between">
							<Label htmlFor="payload-template-editor">Payload Template</Label>
							<button
								type="button"
								onClick={formatJSON}
								className="text-xs text-primary hover:underline"
								aria-label="Format JSON"
							>
								Format JSON
							</button>
						</div>
						<Textarea
							id="payload-template-editor"
							value={payload}
							onChange={(e) => handlePayloadChange(e.target.value)}
							placeholder='{"event": "order.created", "data": {...}}'
							aria-label="Payload Template Editor"
							aria-invalid={!!payloadError}
							className={cn(payloadError && 'border-alert-error')}
						/>
						{payloadError && (
							<p className="text-xs text-alert-error" role="alert">
								{payloadError}
							</p>
						)}
					</div>

					{/* Batch Progress (when running) */}
					{batchProgress && status === 'submitting' && (
						<div className="space-y-sm animate-fade-in">
							<div className="flex items-center justify-between">
								<Label>Progress</Label>
								<span className="text-sm font-medium text-neutral-100">
									{batchProgress.current} / {batchProgress.total}
								</span>
							</div>
							<div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden">
								<div
									className="bg-primary h-full transition-all duration-300"
									style={{
										width: `${(batchProgress.current / batchProgress.total) * 100}%`,
									}}
									role="progressbar"
									aria-valuenow={batchProgress.current}
									aria-valuemin={0}
									aria-valuemax={batchProgress.total}
									aria-label={`Batch progress: ${batchProgress.current} of ${batchProgress.total} events processed`}
								/>
							</div>
						</div>
					)}
				</Tabs.Content>
			</Tabs.Root>

			{/* Debug Flags Section */}
			<Accordion.Root type="single" collapsible className="w-full">
				<Accordion.Item value="debug-flags" className="border-0">
					<Accordion.Trigger
						className={cn(
							'flex items-center justify-between w-full py-md px-lg rounded-md',
							'text-sm font-medium text-neutral-100',
							'hover:bg-surface-elevated/50 transition-colors',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
							'[&[data-state=open]>svg]:rotate-180'
						)}
						aria-label="Toggle debug flags section"
					>
						<div className="flex items-center gap-sm">
							<span>Debug Flags</span>
							{activeDebugFlagsCount > 0 && (
								<span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-alert-warning/20 text-alert-warning">
									{activeDebugFlagsCount} active
								</span>
							)}
						</div>
						<ChevronDownIcon />
					</Accordion.Trigger>
					<Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
						<div className="pt-lg space-y-md">
							{/* Trigger Validation Error */}
							<div className="flex items-center justify-between px-lg py-sm rounded-md hover:bg-surface-elevated/30 transition-colors">
								<div className="space-y-0.5">
									<Label
										htmlFor="debug-validation-error"
										className="text-sm font-medium cursor-pointer"
									>
										Trigger Validation Error
									</Label>
									<p className="text-xs text-neutral-400">
										Simulates invalid payload submission
									</p>
								</div>
								<Switch
									id="debug-validation-error"
									checked={debugFlags.trigger_validation_error || false}
									onCheckedChange={(checked) =>
										handleDebugFlagToggle('trigger_validation_error', checked)
									}
									aria-label="Trigger Validation Error (simulates invalid payload)"
								/>
							</div>

							{/* Trigger Processing Error */}
							<div className="flex items-center justify-between px-lg py-sm rounded-md hover:bg-surface-elevated/30 transition-colors">
								<div className="space-y-0.5">
									<Label
										htmlFor="debug-processing-error"
										className="text-sm font-medium cursor-pointer"
									>
										Trigger Processing Error
									</Label>
									<p className="text-xs text-neutral-400">
										Simulates workflow processing failure
									</p>
								</div>
								<Switch
									id="debug-processing-error"
									checked={debugFlags.trigger_processing_error || false}
									onCheckedChange={(checked) =>
										handleDebugFlagToggle('trigger_processing_error', checked)
									}
									aria-label="Trigger Processing Error (simulates workflow failure)"
								/>
							</div>

							{/* Inject Latency */}
							<div className="space-y-sm px-lg">
								<div className="flex items-center justify-between">
									<Label htmlFor="debug-latency-slider" className="text-sm font-medium">
										Inject Latency
									</Label>
									<span className="text-sm font-medium text-neutral-100">
										{debugFlags.inject_latency_ms || 0}ms
									</span>
								</div>
								<p className="text-xs text-neutral-400">
									Simulates slow processing (0-5000ms)
								</p>
								<Slider
									id="debug-latency-slider"
									min={0}
									max={5000}
									step={100}
									value={[debugFlags.inject_latency_ms || 0]}
									onValueChange={([value]) =>
										handleDebugFlagToggle('inject_latency_ms', value)
									}
									aria-label={`Inject latency, currently ${debugFlags.inject_latency_ms || 0} milliseconds`}
									className="w-full"
								/>
							</div>
						</div>
					</Accordion.Content>
				</Accordion.Item>
			</Accordion.Root>

			{/* CTA Button */}
			<div className="space-y-md">
				<Button
					variant={buttonState.variant}
					size="lg"
					onClick={status === 'failed' ? retry : handleSubmit}
					disabled={buttonState.disabled}
					className={cn('w-full', buttonState.className)}
					aria-label={buttonState.text}
					aria-busy={status === 'submitting' || status === 'retry'}
				>
					{buttonState.icon}
					<span className="hidden sm:inline">{buttonState.text}</span>
					<span className="sm:hidden">
						{runMode === 'batch' ? 'Run Bulk' : 'Run'}
					</span>
					{activeDebugFlagsCount > 0 && status === 'idle' && (
						<span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-alert-warning/20 text-alert-warning">
							{activeDebugFlagsCount} flag{activeDebugFlagsCount > 1 ? 's' : ''}
						</span>
					)}
				</Button>

				{/* Timestamp Badge */}
				{submittedAt && (
					<div className="text-center text-xs text-neutral-400 animate-fade-in">
						{status === 'submitting' || status === 'retry' ? (
							<span>
								Sending event... ({formatElapsedTime(submittedAt, null)} elapsed)
							</span>
						) : completedAt ? (
							<span>Completed in {formatElapsedTime(submittedAt, completedAt)}</span>
						) : (
							<span>Submitted {formatTimestamp(submittedAt)}</span>
						)}
					</div>
				)}
			</div>

			{/* Status Message Area */}
			{(runId || runError) && (
				<div
					className={cn(
						'p-lg rounded-md border-2 animate-slide-in',
						status === 'success' &&
							'bg-alert-success/10 border-alert-success/30 text-neutral-100',
						status === 'failed' && 'bg-alert-error/10 border-alert-error/30 text-neutral-100'
					)}
					role="status"
					aria-live="polite"
				>
					{status === 'success' && runId && (
						<div className="space-y-sm">
							<div className="flex items-start gap-sm">
								<CheckIcon />
								<div className="flex-1 space-y-1">
									<p className="text-sm font-medium">Event delivered successfully</p>
									<p className="text-xs text-neutral-400">
										Run ID: <code className="font-mono text-neutral-100">{runId}</code>
									</p>
									{batchProgress && (
										<p className="text-xs text-neutral-400">
											{batchProgress.current} of {batchProgress.total} events processed
										</p>
									)}
								</div>
							</div>
							<p className="text-xs text-neutral-400 pl-7">
								View in Timeline → (Story 7.3)
							</p>
						</div>
					)}

					{status === 'failed' && runError && (
						<div className="space-y-sm">
							<div className="flex items-start gap-sm">
								<ErrorIcon />
								<div className="flex-1 space-y-1">
									<p className="text-sm font-medium">Submission failed</p>
									<p className="text-xs">
										<span className="font-mono text-alert-error">{runError.code}</span>:{' '}
										{runError.message}
									</p>
									{runError.details && (
										<p className="text-xs text-neutral-400">{runError.details}</p>
									)}
								</div>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={retry}
								className="w-full mt-sm"
								aria-label="Retry submission"
							>
								Retry
							</Button>
						</div>
					)}
				</div>
			)}
		</section>
	);
}
