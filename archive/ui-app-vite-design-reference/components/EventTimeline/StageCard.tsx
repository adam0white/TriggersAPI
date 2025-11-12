/**
 * StageCard Component - Individual stage card in Event Timeline
 * Story 7.3: Event Timeline Canvas
 *
 * Displays a single stage (Ingress, Queue, Processing, Inbox) with:
 * - Stage name and icon
 * - Status indicator (idle, active, success, error, pending)
 * - Latency badge
 * - Error snippet (if failed)
 * - Log drawer trigger button
 * - Animated state transitions
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { StageCardProps, StageName } from '@/types/runs';

/**
 * Stage icons - using simple SVG icons
 */
const StageIcons: Record<StageName, React.FC<{ className?: string }>> = {
	ingress: ({ className }) => (
		<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
		</svg>
	),
	queue: ({ className }) => (
		<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
		</svg>
	),
	processing: ({ className }) => (
		<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
		</svg>
	),
	inbox: ({ className }) => (
		<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
		</svg>
	),
};

/**
 * Success checkmark icon
 */
const CheckIcon = ({ className }: { className?: string }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
	</svg>
);

/**
 * Error/alert icon
 */
const ErrorIcon = ({ className }: { className?: string }) => (
	<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
	</svg>
);

/**
 * Spinner icon (for active state)
 */
const SpinnerIcon = ({ className }: { className?: string }) => (
	<svg className={cn('animate-spin', className)} fill="none" viewBox="0 0 24 24" aria-hidden="true">
		<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
		<path
			className="opacity-75"
			fill="currentColor"
			d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
		></path>
	</svg>
);

/**
 * Format duration in milliseconds to readable string
 */
function formatDuration(durationMs: number | null): string {
	if (durationMs === null || durationMs === undefined) return '—';
	if (durationMs < 1000) return `${durationMs}ms`;
	return `${(durationMs / 1000).toFixed(2)}s`;
}

/**
 * Get stage display name
 */
function getStageName(stage: StageName): string {
	const names: Record<StageName, string> = {
		ingress: 'Ingress',
		queue: 'Queue',
		processing: 'Processing',
		inbox: 'Inbox',
	};
	return names[stage];
}

/**
 * StageCard Component
 */
export function StageCard({
	stage,
	stageState,
	isActive,
	isInteractive,
	onViewLogs,
	className,
}: StageCardProps) {
	const { status, timing, error } = stageState;
	const StageIcon = StageIcons[stage];

	/**
	 * Get card background color based on status
	 */
	const getCardBg = () => {
		if (status === 'idle') return 'bg-surface-elevated/40';
		if (status === 'active') return 'bg-surface-elevated';
		if (status === 'success') return 'bg-surface-elevated/60';
		if (status === 'error') return 'bg-surface-elevated';
		if (status === 'pending') return 'bg-surface-elevated/30';
		return 'bg-surface-elevated/40';
	};

	/**
	 * Get card border color based on status
	 */
	const getCardBorder = () => {
		if (status === 'active') return 'border-primary/40';
		if (status === 'error') return 'border-alert-error';
		if (status === 'success') return 'border-accent-1/30';
		return 'border-neutral-500/20';
	};

	/**
	 * Get card shadow/glow based on status
	 */
	const getCardShadow = () => {
		if (status === 'active') return 'shadow-card-active';
		if (status === 'success') return 'shadow-sm';
		if (status === 'error') return 'shadow-md shadow-alert-error/20';
		return 'shadow-card-base';
	};

	/**
	 * Get status icon
	 */
	const getStatusIcon = () => {
		if (status === 'active') return <SpinnerIcon className="w-5 h-5 text-primary motion-reduce:hidden" />;
		if (status === 'success') return <CheckIcon className="w-5 h-5 text-accent-1" />;
		if (status === 'error') return <ErrorIcon className="w-5 h-5 text-alert-error" />;
		return <StageIcon className="w-5 h-5 text-neutral-400" />;
	};

	/**
	 * Get ARIA label for stage card
	 */
	const getAriaLabel = () => {
		const name = getStageName(stage);
		if (status === 'idle') return `${name} stage: not started`;
		if (status === 'pending') return `${name} stage: waiting for upstream`;
		if (status === 'active') return `${name} stage: in progress`;
		if (status === 'success') {
			const duration = formatDuration(timing.duration_ms);
			return `${name} stage: completed in ${duration}`;
		}
		if (status === 'error') return `${name} stage: failed, ${error?.code || 'unknown error'}`;
		return `${name} stage`;
	};

	return (
		<div
			role="region"
			aria-label={getAriaLabel()}
			className={cn(
				'relative rounded-lg border transition-all duration-300',
				getCardBg(),
				getCardBorder(),
				getCardShadow(),
				'p-lg space-y-sm',
				status === 'idle' && 'opacity-50',
				status === 'pending' && 'opacity-60',
				className
			)}
		>
			{/* Header: Stage name and icon */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-sm">
					{getStatusIcon()}
					<h3 className="text-h3 text-neutral-100 font-medium">{getStageName(stage)}</h3>
				</div>

				{/* Latency badge */}
				{timing.duration_ms !== null && status !== 'idle' && status !== 'pending' && (
					<span
						className={cn(
							'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
							status === 'success' && 'bg-alert-success/20 text-accent-1',
							status === 'error' && 'bg-alert-error/20 text-alert-error',
							status === 'active' && 'bg-primary/20 text-primary'
						)}
						aria-label={`Duration: ${formatDuration(timing.duration_ms)}`}
					>
						{formatDuration(timing.duration_ms)}
					</span>
				)}

				{/* Placeholder for idle/pending states */}
				{(status === 'idle' || status === 'pending') && (
					<span className="text-xs text-neutral-400" aria-label="Duration pending">
						—
					</span>
				)}
			</div>

			{/* Error snippet (if failed) */}
			{status === 'error' && error && (
				<div
					className="mt-sm p-sm rounded bg-alert-error/10 border border-alert-error/30 animate-fade-in"
					role="alert"
					aria-live="assertive"
				>
					<div className="flex items-start gap-sm">
						<ErrorIcon className="w-4 h-4 text-alert-error flex-shrink-0 mt-0.5" />
						<div className="flex-1 min-w-0">
							<p className="text-xs font-medium text-alert-error">{error.code}</p>
							<p className="text-xs text-neutral-100 line-clamp-2 mt-0.5">{error.message}</p>
							{error.log_snippet && (
								<p className="text-xs text-neutral-400 line-clamp-1 mt-0.5 font-mono">{error.log_snippet}</p>
							)}
						</div>
					</div>

					{/* View Logs button for errors */}
					{isInteractive && onViewLogs && (
						<button
							onClick={onViewLogs}
							className={cn(
								'mt-sm w-full py-1.5 px-3 rounded text-xs font-medium',
								'bg-alert-error/20 text-alert-error',
								'hover:bg-alert-error/30 active:bg-alert-error/40',
								'transition-colors duration-150',
								'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-elevated'
							)}
							aria-label={`View logs for ${getStageName(stage)} stage`}
						>
							View Logs
						</button>
					)}
				</div>
			)}

			{/* Log drawer trigger for non-error states (subtle button) */}
			{isInteractive && status !== 'idle' && status !== 'pending' && status !== 'error' && onViewLogs && (
				<button
					onClick={onViewLogs}
					className={cn(
						'absolute bottom-2 right-2 p-1.5 rounded',
						'text-neutral-400 hover:text-neutral-100 hover:bg-surface-base/50',
						'transition-colors duration-150',
						'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-elevated',
						'opacity-0 group-hover:opacity-100 focus:opacity-100'
					)}
					aria-label={`View logs for ${getStageName(stage)} stage`}
					title="View logs"
				>
					<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</button>
			)}

			{/* Error badge (top-right corner) */}
			{status === 'error' && (
				<div
					className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-alert-error text-neutral-100 text-xs font-bold shadow-md animate-slide-in"
					aria-label="Stage failed"
				>
					Failed
				</div>
			)}

			{/* Success badge (optional, can be enabled for visual confirmation) */}
			{status === 'success' && isActive && (
				<div
					className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-accent-1 text-surface-elevated text-xs font-bold shadow-md animate-slide-in"
					aria-label="Stage completed"
				>
					✓
				</div>
			)}
		</div>
	);
}
