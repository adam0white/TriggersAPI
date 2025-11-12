/**
 * EventRow Component - Individual event table row with expansion
 * Story 7.4: Telemetry Panels Upgrade
 *
 * Features:
 * - Event metadata display (ID, status, timestamp, latency, flags)
 * - Row expansion for full payload and details
 * - Status badge with color coding
 * - Retry/Copy actions per event
 * - Highlight animation for new events
 */

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface EventData {
	event_id: string;
	status: 'success' | 'failed' | 'processing';
	timestamp: string; // ISO8601
	latency_ms: number;
	flags?: string[]; // Debug flags applied
	payload?: Record<string, unknown>;
	request_headers?: Record<string, string>;
	response_metadata?: {
		run_duration_ms: number;
		processing_notes?: string;
	};
	retry_eligible?: boolean;
}

interface EventRowProps {
	event: EventData;
	isSelected: boolean;
	isHighlighted?: boolean;
	onSelect: (eventId: string, selected: boolean) => void;
	onRetry?: (eventId: string) => void;
	onCopyId: (eventId: string) => void;
}

/**
 * Format timestamp to relative time (e.g., "2s ago")
 */
function formatRelativeTime(timestamp: string): string {
	const now = Date.now();
	const then = new Date(timestamp).getTime();
	const diffMs = now - then;
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHr = Math.floor(diffMin / 60);

	if (diffSec < 60) return `${diffSec}s ago`;
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	return new Date(timestamp).toLocaleDateString();
}

/**
 * Get badge variant based on event status
 */
function getStatusBadge(status: 'success' | 'failed' | 'processing'): {
	variant: 'success' | 'error' | 'secondary';
	label: string;
} {
	switch (status) {
		case 'success':
			return { variant: 'success', label: 'Success' };
		case 'failed':
			return { variant: 'error', label: 'Failed' };
		case 'processing':
			return { variant: 'secondary', label: 'Processing' };
	}
}

/**
 * Mask sensitive auth tokens (show first 8 + last 4 chars)
 */
function maskToken(token: string): string {
	if (token.length <= 12) return '***';
	return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

export function EventRow({ event, isSelected, isHighlighted = false, onSelect, onRetry, onCopyId }: EventRowProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [shouldHighlight, setShouldHighlight] = useState(isHighlighted);

	// Remove highlight after animation completes (1s fade)
	useEffect(() => {
		if (isHighlighted) {
			const timer = setTimeout(() => setShouldHighlight(false), 1000);
			return () => clearTimeout(timer);
		}
	}, [isHighlighted]);

	const relativeTime = formatRelativeTime(event.timestamp);
	const statusBadge = getStatusBadge(event.status);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(event.event_id);
			onCopyId(event.event_id);
		} catch (err) {
			console.error('Failed to copy event ID:', err);
		}
	};

	const handleRetry = () => {
		if (onRetry && event.retry_eligible) {
			onRetry(event.event_id);
		}
	};

	return (
		<>
			{/* Main Row */}
			<TableRow
				className={cn(
					'cursor-pointer transition-all',
					shouldHighlight && 'animate-pulse-highlight bg-primary/10',
					isExpanded && 'bg-surface-elevated',
					event.status === 'failed' && 'bg-alert-error/5'
				)}
				onClick={() => setIsExpanded(!isExpanded)}
				data-state={isSelected ? 'selected' : undefined}
				role="row"
				aria-expanded={isExpanded}
			>
				{/* Checkbox */}
				<TableCell className="w-12">
					<Checkbox
						checked={isSelected}
						onChange={(e) => {
							e.stopPropagation();
							onSelect(event.event_id, (e.target as HTMLInputElement).checked);
						}}
						onClick={(e) => e.stopPropagation()}
						aria-label={`Select event ${event.event_id}`}
					/>
				</TableCell>

				{/* Event ID */}
				<TableCell className="font-mono text-xs max-w-[120px] truncate" title={event.event_id}>
					{event.event_id}
				</TableCell>

				{/* Status */}
				<TableCell>
					<Badge variant={statusBadge.variant} aria-label={`Status: ${statusBadge.label}`}>
						{statusBadge.label}
					</Badge>
				</TableCell>

				{/* Timestamp */}
				<TableCell className="text-neutral-400 text-xs" title={event.timestamp}>
					{relativeTime}
				</TableCell>

				{/* Latency */}
				<TableCell className="text-xs">{event.latency_ms}ms</TableCell>

				{/* Flags (hidden on mobile) */}
				<TableCell className="hidden md:table-cell text-xs text-neutral-400 max-w-[150px] truncate">
					{event.flags && event.flags.length > 0 ? event.flags.join(', ') : '—'}
				</TableCell>

				{/* Actions */}
				<TableCell>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							onClick={(e) => {
								e.stopPropagation();
								handleCopy();
							}}
							aria-label="Copy event ID"
							className="h-7 px-2 text-xs"
						>
							Copy
						</Button>
						{event.status === 'failed' && event.retry_eligible && (
							<Button
								variant="ghost"
								size="sm"
								onClick={(e) => {
									e.stopPropagation();
									handleRetry();
								}}
								aria-label="Retry event"
								className="h-7 px-2 text-xs text-primary"
							>
								Retry
							</Button>
						)}
					</div>
				</TableCell>
			</TableRow>

			{/* Expanded Details Row */}
			{isExpanded && (
				<TableRow className="bg-surface-elevated">
					<TableCell colSpan={7} className="p-0">
						<div className="p-4 space-y-4 animate-slide-down" role="region" aria-label="Event details">
							{/* Event Payload */}
							{event.payload && (
								<div>
									<p className="text-xs text-neutral-400 mb-2">Event Payload:</p>
									<pre className="text-xs font-mono bg-surface p-3 rounded overflow-x-auto scrollbar-dark border border-neutral-400/20">
										{JSON.stringify(event.payload, null, 2)}
									</pre>
								</div>
							)}

							{/* Request Headers */}
							{event.request_headers && (
								<div>
									<p className="text-xs text-neutral-400 mb-2">Request Headers:</p>
									<div className="text-xs font-mono bg-surface p-3 rounded border border-neutral-400/20">
										{Object.entries(event.request_headers).map(([key, value]) => (
											<div key={key} className="flex gap-2">
												<span className="text-neutral-400">{key}:</span>
												<span className="text-neutral-100">
													{key.toLowerCase().includes('auth') || key.toLowerCase().includes('token')
														? maskToken(value)
														: value}
												</span>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Response Metadata */}
							{event.response_metadata && (
								<div>
									<p className="text-xs text-neutral-400 mb-2">Response Metadata:</p>
									<div className="text-xs bg-surface p-3 rounded border border-neutral-400/20">
										<p className="text-neutral-100">
											Run Duration: <span className="font-mono">{event.response_metadata.run_duration_ms}ms</span>
										</p>
										{event.response_metadata.processing_notes && (
											<p className="text-neutral-400 mt-1">{event.response_metadata.processing_notes}</p>
										)}
									</div>
								</div>
							)}

							{/* Action Buttons in Expanded View */}
							<div className="flex items-center gap-2 pt-2 border-t border-neutral-400/20">
								<Button variant="outline" size="sm" onClick={handleCopy}>
									Copy Event ID
								</Button>
								{event.status === 'failed' && event.retry_eligible && (
									<Button variant="default" size="sm" onClick={handleRetry}>
										Retry Event
									</Button>
								)}
								<Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
									Close
								</Button>
							</div>
						</div>
					</TableCell>
				</TableRow>
			)}
		</>
	);
}
