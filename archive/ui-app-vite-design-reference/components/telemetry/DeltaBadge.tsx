import React from 'react';
import { cn } from '@/lib/utils';
import type { DeltaBadgeProps } from '@/types/metrics';

/**
 * DeltaBadge Component
 * Story 7.5: Visual indicator for metric changes
 *
 * Features:
 * - Shows numeric change with arrow indicator
 * - Color-coded: green (positive), red (negative), gray (neutral)
 * - Tooltip shows comparison context
 * - Accessible with descriptive aria-label
 *
 * Design:
 * - Positioned top-right of metric tile
 * - Compact display (icon + value)
 * - High contrast for readability
 */

export function DeltaBadge({ delta, className }: DeltaBadgeProps) {
	// Determine color classes based on change
	const colorClasses = delta.isPositive
		? 'bg-green-500/10 text-green-400 border-green-500/20'
		: delta.direction === 'neutral'
			? 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'
			: 'bg-red-500/10 text-red-400 border-red-500/20';

	// Arrow icon
	const arrowIcon =
		delta.direction === 'up' ? '↑' :
		delta.direction === 'down' ? '↓' :
		'→';

	// Accessible label
	const ariaLabel = `${delta.text} ${delta.comparedTo ? `vs ${delta.comparedTo}` : 'vs last run'}`;

	return (
		<div
			className={cn(
				'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium',
				colorClasses,
				className
			)}
			aria-label={ariaLabel}
			title={ariaLabel}
		>
			<span aria-hidden="true">{arrowIcon}</span>
			<span>{delta.text}</span>
		</div>
	);
}
