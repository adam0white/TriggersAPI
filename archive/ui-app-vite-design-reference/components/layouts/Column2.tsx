import React from 'react';
import { cn } from '@/lib/utils';
import * as Accordion from '@radix-ui/react-accordion';

/**
 * Column 2 - Secondary Column (Telemetry Stack)
 * Story 7.1: Contains collapsible telemetry panels (Logs, Inbox, Metrics, History)
 *
 * Features:
 * - Stacked collapsible panels using Radix Accordion
 * - One panel expanded by default
 * - On tablet/mobile, collapses into accordion below Column 1
 *
 * @example
 * ```tsx
 * <Column2>
 *   <LogsPanel />
 *   <InboxPanel />
 *   <MetricsPanel />
 *   <HistoryPanel />
 * </Column2>
 * ```
 */

interface Column2Props {
	children: React.ReactNode;
	className?: string;
	defaultExpanded?: string; // ID of panel to expand by default
}

export function Column2({ children, className, defaultExpanded = 'logs' }: Column2Props) {
	return (
		<aside
			className={cn(
				// Layout
				'flex flex-col',
				// Spacing
				'gap-lg',
				// Height management
				'h-full',
				className
			)}
			role="region"
			aria-label="Telemetry Panels"
		>
			<Accordion.Root
				type="single"
				defaultValue={defaultExpanded}
				collapsible
				className="flex flex-col gap-lg"
			>
				{children}
			</Accordion.Root>
		</aside>
	);
}

/**
 * Telemetry Panel Wrapper
 * Individual collapsible panel for telemetry data
 */
interface TelemetryPanelProps {
	id: string;
	title: string;
	children: React.ReactNode;
	icon?: React.ReactNode;
	badge?: string | number;
	className?: string;
}

export function TelemetryPanel({ id, title, children, icon, badge, className }: TelemetryPanelProps) {
	return (
		<Accordion.Item
			value={id}
			className={cn(
				// Card styling
				'card-base',
				// Transitions
				'transition-all duration-200',
				// Focus styles
				'focus-within:ring-2 focus-within:ring-primary',
				className
			)}
		>
			<Accordion.Header>
				<Accordion.Trigger
					className={cn(
						// Layout
						'flex w-full items-center justify-between',
						// Spacing
						'px-xl py-lg',
						// Typography
						'font-headline text-h3 text-neutral-100',
						// Hover state
						'hover:bg-surface-elevated/50',
						// Focus state
						'focus:outline-none',
						// Transition
						'transition-colors'
					)}
					aria-label={`Toggle ${title} panel`}
				>
					<div className="flex items-center gap-md">
						{icon && <span className="text-accent-1">{icon}</span>}
						<span>{title}</span>
						{badge !== undefined && (
							<span
								className="rounded-full bg-primary px-2 py-1 text-caption text-neutral-100"
								aria-label={`${badge} items`}
							>
								{badge}
							</span>
						)}
					</div>
					<ChevronIcon />
				</Accordion.Trigger>
			</Accordion.Header>
			<Accordion.Content
				className={cn(
					// Animation
					'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
					// Overflow
					'overflow-hidden',
					// Spacing
					'px-xl pb-xl'
				)}
			>
				<div className="pt-md">{children}</div>
			</Accordion.Content>
		</Accordion.Item>
	);
}

/**
 * Chevron Icon for Accordion Toggle
 */
function ChevronIcon() {
	return (
		<svg
			className="h-5 w-5 text-neutral-400 transition-transform duration-200 group-data-[state=open]:rotate-180"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
		</svg>
	);
}
