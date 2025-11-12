/**
 * Empty State Component
 * Story 7.6: UX Pattern Implementation
 *
 * Reusable empty state component for panels with no data.
 * Provides consistent layout: icon + heading + message + optional CTA.
 *
 * Used in:
 * - Logs panel (no logs yet)
 * - Inbox panel (no events)
 * - Metrics panel (no runs)
 * - History panel (no history)
 * - DLQ panel (no failed events)
 */

import React from 'react';

export interface EmptyStateProps {
	icon: string;
	heading: string;
	message: string;
	action?: {
		label: string;
		onClick: () => void;
	};
	subMessage?: string;
}

export function EmptyState({ icon, heading, message, action, subMessage }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
			{/* Icon */}
			<div className="text-5xl mb-4 opacity-50" aria-hidden="true">
				{icon}
			</div>

			{/* Heading */}
			<h3 className="text-lg font-medium text-[#FFFDF9] mb-2">{heading}</h3>

			{/* Message */}
			<p className="text-sm text-[#FFF3E6] max-w-md leading-relaxed mb-4">{message}</p>

			{/* CTA Button */}
			{action && (
				<button
					onClick={action.onClick}
					className="px-4 py-2 bg-[#FF4F00] text-white text-sm font-medium rounded
						hover:bg-[#E64600] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]
						transition-colors"
				>
					{action.label}
				</button>
			)}

			{/* Sub-message (e.g., keyboard shortcut hint) */}
			{subMessage && (
				<p className="mt-3 text-xs text-[#FFF3E6]/70">
					{subMessage}
				</p>
			)}
		</div>
	);
}

/**
 * Preset empty states for common panels
 */

export function LogsEmptyState({ onRunEvent }: { onRunEvent?: () => void }) {
	return (
		<EmptyState
			icon="📋"
			heading="No logs yet"
			message="Run an event to see logs. Logs will appear here as your event moves through the pipeline."
			action={onRunEvent ? { label: 'Run Default Event', onClick: onRunEvent } : undefined}
		/>
	);
}

export function InboxEmptyState({ onRunEvent }: { onRunEvent?: () => void }) {
	return (
		<EmptyState
			icon="📥"
			heading="Inbox is empty"
			message="Submit your first event using the Run Command panel above."
			action={onRunEvent ? { label: 'Run Default Event', onClick: onRunEvent } : undefined}
		/>
	);
}

export function MetricsEmptyState() {
	return (
		<EmptyState
			icon="📊"
			heading="No metrics available"
			message="Metrics will update as you run events. Track velocity, success rate, latency, and queue depth in real-time."
		/>
	);
}

export function HistoryEmptyState({ onRunEvent }: { onRunEvent?: () => void }) {
	return (
		<EmptyState
			icon="🕐"
			heading="No run history"
			message="Your run history will appear here. Run an event to start."
			action={onRunEvent ? { label: 'Run Default Event Now', onClick: onRunEvent } : undefined}
		/>
	);
}

export function DLQEmptyState() {
	return (
		<EmptyState
			icon="✅"
			heading="DLQ is empty"
			message="All events processed successfully. No failed events in the Dead Letter Queue."
		/>
	);
}

/**
 * Dashboard initial welcome state
 */
export function WelcomeEmptyState({ onRunEvent }: { onRunEvent?: () => void }) {
	return (
		<div className="min-h-screen flex items-center justify-center bg-[#201515]">
			<div className="text-center px-4">
				{/* Large icon */}
				<div className="text-8xl mb-6" aria-hidden="true">
					⚡
				</div>

				{/* Welcome heading */}
				<h1 className="text-3xl font-bold text-gradient-primary mb-4">
					Welcome to Mission-Control Pulse
				</h1>

				{/* Message */}
				<p className="text-lg text-[#FFF3E6] max-w-2xl mx-auto leading-relaxed mb-8">
					Fire your first event to begin. The dashboard will show you the journey through the
					pipeline in real-time.
				</p>

				{/* CTA */}
				{onRunEvent && (
					<button
						onClick={onRunEvent}
						className="px-6 py-3 bg-[#FF4F00] text-white text-base font-medium rounded-lg
							hover:bg-[#E64600] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]
							transition-colors shadow-lg"
					>
						Run Default Event
					</button>
				)}

				{/* Keyboard hint */}
				<p className="mt-6 text-sm text-[#FFF3E6]/70">
					Or press{' '}
					<kbd className="px-2 py-1 bg-[rgba(255,253,249,0.1)] rounded border border-[rgba(255,253,249,0.1)]">
						⌘K
					</kbd>{' '}
					to explore shortcuts
				</p>
			</div>
		</div>
	);
}
