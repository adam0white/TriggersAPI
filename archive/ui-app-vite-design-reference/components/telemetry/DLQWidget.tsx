import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { DLQWidgetProps } from '@/types/metrics';

/**
 * DLQWidget Component
 * Story 7.5: Dead Letter Queue visibility widget
 *
 * Features:
 * - Shows count of events in DLQ
 * - Warning icon and color coding
 * - Click to expand details
 * - "Retry All" button when count > 0
 * - State-based styling
 *
 * States:
 * - Green (0 events): All clear
 * - Amber (1-5 events): Warning
 * - Red (>5 events): Critical attention needed
 *
 * Accessibility:
 * - Clear aria-label with count
 * - Status role for screen readers
 * - Keyboard activatable button
 */

export function DLQWidget({ count, onExpand, onRetryAll, className }: DLQWidgetProps) {
	// State-based styling
	const state = count === 0 ? 'success' : count <= 5 ? 'warning' : 'critical';

	const stateClasses =
		state === 'critical'
			? 'border-red-500/50 bg-red-500/5 text-red-400'
			: state === 'warning'
				? 'border-amber-500/50 bg-amber-500/5 text-amber-400'
				: 'border-green-500/50 bg-green-500/5 text-green-400';

	const icon = state === 'success' ? '✓' : '⚠️';

	return (
		<div
			className={cn(
				'rounded-lg border p-3 flex items-center justify-between',
				stateClasses,
				className
			)}
			role="status"
			aria-label={`Dead Letter Queue: ${count} events`}
		>
			<button
				onClick={onExpand}
				className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity"
				aria-label={`View ${count} events in Dead Letter Queue`}
			>
				<span className="text-xl" aria-hidden="true">
					{icon}
				</span>
				<div>
					<p className="text-sm font-medium">
						DLQ: {count} {count === 1 ? 'event' : 'events'}
					</p>
					<p className="text-xs opacity-70">
						{count === 0 ? 'No failures' : 'Events requiring retry'}
					</p>
				</div>
			</button>

			{count > 0 && onRetryAll && (
				<Button
					size="sm"
					variant="outline"
					onClick={(e) => {
						e.stopPropagation();
						onRetryAll();
					}}
					className="ml-2 text-xs"
					aria-label={`Retry all ${count} failed events`}
				>
					Retry All
				</Button>
			)}
		</div>
	);
}
