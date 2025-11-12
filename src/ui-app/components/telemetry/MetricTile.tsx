import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkline } from './Sparkline';
import { DeltaBadge } from './DeltaBadge';
import type { MetricTileProps } from '@/types/metrics';

/**
 * MetricTile Component
 * Story 7.5: Individual metric display with value, delta, and sparkline
 *
 * Features:
 * - Large metric value with icon
 * - Subtext for additional context
 * - Delta badge showing change
 * - Sparkline for trend visualization
 * - State-based styling (normal, warning, critical)
 * - Hover elevation effect
 * - Click support for drill-down
 *
 * Accessibility:
 * - Semantic structure with aria-label
 * - Live region for value updates (aria-live="polite")
 * - Keyboard interactive if onClick provided
 *
 * States:
 * - Normal: Default border
 * - Warning: Peach/amber border
 * - Critical: Red border with fill
 */

export function MetricTile({ metric, onClick, className }: MetricTileProps) {
	const isInteractive = !!onClick;

	// State-based styling
	const stateClasses =
		metric.state === 'critical'
			? 'border-red-500/50 bg-red-500/5'
			: metric.state === 'warning'
				? 'border-amber-500/50 bg-amber-500/5'
				: 'border-neutral-400/20 bg-surface-elevated/50';

	const hoverClasses = isInteractive
		? 'hover:border-neutral-400/40 hover:shadow-card-active cursor-pointer transition-all duration-150'
		: '';

	return (
		<div
			className={cn(
				'relative rounded-lg border p-4 flex flex-col gap-2',
				stateClasses,
				hoverClasses,
				className
			)}
			onClick={onClick}
			onKeyDown={(e) => {
				if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
					e.preventDefault();
					onClick?.();
				}
			}}
			role={isInteractive ? 'button' : undefined}
			tabIndex={isInteractive ? 0 : undefined}
			aria-label={`${metric.label}: ${metric.value}${metric.unit || ''}`}
		>
			{/* Header: Icon + Label + Delta Badge */}
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-2">
					<span className="text-xl" aria-hidden="true">
						{metric.icon}
					</span>
					<p className="text-caption text-neutral-400">{metric.label}</p>
				</div>
				<DeltaBadge delta={metric.delta} />
			</div>

			{/* Main Value */}
			<div className="flex items-end justify-between gap-4">
				<div className="flex-1">
					<p
						className="text-h2 text-neutral-100 font-headline leading-none mb-1"
						aria-live="polite"
					>
						{metric.value}
						{metric.unit && <span className="text-body text-neutral-400 ml-1">{metric.unit}</span>}
					</p>
					<p className="text-xs text-neutral-400">{metric.subtext}</p>
				</div>

				{/* Sparkline (hidden on mobile) */}
				<div className="hidden md:block">
					<Sparkline
						data={metric.sparkline}
						type={metric.id === 'totalEvents' ? 'bar' : metric.id === 'queueDepth' ? 'step' : metric.id === 'latency' ? 'area' : 'line'}
						color={metric.state === 'critical' ? 'error' : metric.state === 'warning' ? 'warning' : 'accent'}
					/>
				</div>
			</div>

			{/* Loading skeleton fade-in animation */}
			<style>{`
				@keyframes fadeIn {
					from {
						opacity: 0;
					}
					to {
						opacity: 1;
					}
				}
				.text-h2 {
					animation: fadeIn 150ms ease-in;
				}
			`}</style>
		</div>
	);
}
