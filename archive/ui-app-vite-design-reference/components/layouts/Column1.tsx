import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Column 1 - Primary Column
 * Story 7.1: Contains Run Command panel (sticky) and Event Timeline (scrollable)
 *
 * Features:
 * - Run Command panel remains sticky at top
 * - Timeline scrolls independently below
 * - Minimum width of 340px maintained on desktop
 *
 * @example
 * ```tsx
 * <Column1>
 *   <RunCommandPanel />
 *   <EventTimeline />
 * </Column1>
 * ```
 */

interface Column1Props {
	children: React.ReactNode;
	className?: string;
}

export function Column1({ children, className }: Column1Props) {
	return (
		<aside
			className={cn(
				// Layout
				'flex flex-col',
				// Minimum width on desktop
				'xl:min-w-hero-rail',
				// Spacing
				'gap-xl',
				// Height management
				'h-full',
				className
			)}
			role="region"
			aria-label="Primary Control Panel"
		>
			{children}
		</aside>
	);
}

/**
 * Sticky Section for Run Command Panel
 * Wraps the Run Command panel to keep it visible during scroll
 */
interface StickySectionProps {
	children: React.ReactNode;
	className?: string;
}

export function StickySection({ children, className }: StickySectionProps) {
	return (
		<div
			className={cn(
				// Sticky positioning
				'sticky top-0 z-10',
				// Background to prevent content overlap
				'bg-surface',
				// Padding to create breathing room
				'pb-md',
				className
			)}
		>
			{children}
		</div>
	);
}

/**
 * Scrollable Section for Event Timeline
 * Wraps the Event Timeline to allow independent scrolling
 */
interface ScrollableSectionProps {
	children: React.ReactNode;
	className?: string;
}

export function ScrollableSection({ children, className }: ScrollableSectionProps) {
	return (
		<div
			className={cn(
				// Scrollable behavior
				'flex-1 overflow-y-auto',
				// Custom scrollbar styling
				'scrollbar-dark',
				className
			)}
		>
			{children}
		</div>
	);
}
