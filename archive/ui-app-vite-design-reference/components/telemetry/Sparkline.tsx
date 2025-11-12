import React from 'react';
import { cn } from '@/lib/utils';
import type { SparklineProps } from '@/types/metrics';

/**
 * Sparkline Component
 * Story 7.5: Lightweight chart for metric trend visualization
 *
 * Features:
 * - Bar, line, area, and step chart types
 * - Compact size (60x40px default)
 * - No axes or labels (keeps visual clean)
 * - Color variants for different metric states
 * - SVG-based for crisp rendering
 *
 * Accessibility:
 * - Decorative role (aria-hidden) as values are in parent
 * - Data available via adjacent text
 */

export function Sparkline({
	data,
	type = 'line',
	color = 'accent',
	width = 60,
	height = 40,
	className,
}: SparklineProps) {
	// Handle empty data
	if (!data || data.length === 0) {
		return (
			<div
				className={cn('flex items-center justify-center text-neutral-400/30', className)}
				style={{ width, height }}
				aria-hidden="true"
			>
				<span className="text-xs">--</span>
			</div>
		);
	}

	// Normalize data to 0-1 range
	const max = Math.max(...data, 1);
	const min = Math.min(...data, 0);
	const range = max - min || 1;
	const normalized = data.map((d) => (d - min) / range);

	// Color mapping
	const colorMap = {
		accent: 'rgb(var(--color-accent-1))',
		warning: 'rgb(var(--color-accent-2))',
		success: 'rgb(var(--color-accent-1))',
		error: 'rgb(var(--color-accent-3))',
	};
	const strokeColor = colorMap[color] || colorMap.accent;
	const fillColor = `${strokeColor}33`; // 20% opacity for area

	// Generate SVG path based on type
	const generatePath = () => {
		const padding = 2;
		const chartWidth = width - padding * 2;
		const chartHeight = height - padding * 2;
		const stepX = chartWidth / (data.length - 1 || 1);

		switch (type) {
			case 'bar': {
				// Bar chart: vertical bars
				const barWidth = Math.max(stepX * 0.6, 2);
				return normalized.map((value, i) => {
					const x = padding + i * stepX - barWidth / 2;
					const barHeight = value * chartHeight;
					const y = padding + chartHeight - barHeight;
					return (
						<rect
							key={i}
							x={x}
							y={y}
							width={barWidth}
							height={barHeight}
							fill={strokeColor}
							opacity={0.8}
						/>
					);
				});
			}

			case 'area': {
				// Area chart: filled polygon
				const points = normalized
					.map((value, i) => {
						const x = padding + i * stepX;
						const y = padding + chartHeight - value * chartHeight;
						return `${x},${y}`;
					})
					.join(' ');

				const areaPath = `M ${padding},${padding + chartHeight} L ${points} L ${padding + chartWidth},${padding + chartHeight} Z`;

				return (
					<>
						<path d={areaPath} fill={fillColor} stroke="none" />
						<path
							d={`M ${points}`}
							fill="none"
							stroke={strokeColor}
							strokeWidth={1.5}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</>
				);
			}

			case 'step': {
				// Step chart: stepped line
				let stepPath = '';
				normalized.forEach((value, i) => {
					const x = padding + i * stepX;
					const y = padding + chartHeight - value * chartHeight;
					if (i === 0) {
						stepPath = `M ${x},${y}`;
					} else {
						const prevX = padding + (i - 1) * stepX;
						stepPath += ` L ${prevX},${y} L ${x},${y}`;
					}
				});

				return (
					<path
						d={stepPath}
						fill="none"
						stroke={strokeColor}
						strokeWidth={1.5}
						strokeLinecap="square"
						strokeLinejoin="miter"
					/>
				);
			}

			case 'line':
			default: {
				// Line chart: smooth curved line
				const points = normalized
					.map((value, i) => {
						const x = padding + i * stepX;
						const y = padding + chartHeight - value * chartHeight;
						return `${x},${y}`;
					})
					.join(' ');

				return (
					<path
						d={`M ${points}`}
						fill="none"
						stroke={strokeColor}
						strokeWidth={1.5}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				);
			}
		}
	};

	return (
		<svg
			width={width}
			height={height}
			className={cn('sparkline', className)}
			aria-hidden="true"
			role="img"
		>
			{generatePath()}
		</svg>
	);
}
