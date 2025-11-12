/**
 * LogEntry Component - Individual log entry display
 * Story 7.4: Telemetry Panels Upgrade
 *
 * Features:
 * - Log level badge with color coding
 * - Timestamp display (relative format with tooltip)
 * - Message truncation with expansion
 * - Metadata expansion for full details
 * - Highlight animation for new entries
 */

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LogEntryData {
	id: string;
	timestamp: string; // ISO8601
	level: 'info' | 'warn' | 'error';
	message: string;
	stage: 'ingress' | 'queue' | 'processing' | 'inbox';
	metadata?: Record<string, unknown>;
	request_id?: string;
	error_code?: string;
}

interface LogEntryProps {
	log: LogEntryData;
	isNew?: boolean;
	isSearchMatch?: boolean;
	searchTerm?: string;
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
 * Highlight search term in message text
 */
function highlightText(text: string, searchTerm: string | undefined): React.ReactNode {
	if (!searchTerm || !text) return text;

	const regex = new RegExp(`(${searchTerm})`, 'gi');
	const parts = text.split(regex);

	return parts.map((part, index) =>
		regex.test(part) ? (
			<mark key={index} className="bg-alert-warning text-neutral-900 px-0.5">
				{part}
			</mark>
		) : (
			part
		)
	);
}

/**
 * Get badge variant based on log level
 */
function getBadgeVariant(level: 'info' | 'warn' | 'error'): 'info' | 'warning' | 'error' {
	switch (level) {
		case 'info':
			return 'info';
		case 'warn':
			return 'warning';
		case 'error':
			return 'error';
	}
}

export function LogEntry({ log, isNew = false, isSearchMatch = false, searchTerm }: LogEntryProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [shouldHighlight, setShouldHighlight] = useState(isNew);

	// Remove highlight after animation completes (1s fade)
	useEffect(() => {
		if (isNew) {
			const timer = setTimeout(() => setShouldHighlight(false), 1000);
			return () => clearTimeout(timer);
		}
	}, [isNew]);

	const relativeTime = formatRelativeTime(log.timestamp);
	const isTruncated = log.message.length > 200;
	const displayMessage = isExpanded || !isTruncated ? log.message : `${log.message.slice(0, 200)}...`;

	return (
		<div
			className={cn(
				'rounded border border-neutral-400/20 bg-surface p-3 transition-all',
				shouldHighlight && 'animate-pulse-highlight bg-primary/10',
				isSearchMatch && 'bg-accent-1/10'
			)}
			role="article"
			aria-label={`Log entry: ${log.level} from ${log.stage} stage`}
		>
			{/* Header: Level badge, Stage, Timestamp */}
			<div className="flex items-center justify-between gap-2 mb-2">
				<div className="flex items-center gap-2">
					<Badge variant={getBadgeVariant(log.level)} aria-label={`Log level: ${log.level}`}>
						{log.level.toUpperCase()}
					</Badge>
					<span className="text-xs text-neutral-400 capitalize">{log.stage}</span>
				</div>
				<span className="text-xs text-neutral-400" title={log.timestamp}>
					{relativeTime}
				</span>
			</div>

			{/* Message */}
			<p className="text-sm text-neutral-100 mb-2 break-words font-mono">
				{highlightText(displayMessage, searchTerm)}
			</p>

			{/* Expand/Collapse Button */}
			{(isTruncated || log.metadata || log.error_code) && (
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setIsExpanded(!isExpanded)}
						aria-expanded={isExpanded}
						aria-controls={`log-details-${log.id}`}
						className="text-xs h-6 px-2"
					>
						{isExpanded ? '↑ Collapse' : '↓ Expand'}
					</Button>
				</div>
			)}

			{/* Expanded Details */}
			{isExpanded && (
				<div
					id={`log-details-${log.id}`}
					className="mt-3 pt-3 border-t border-neutral-400/20 space-y-2 animate-slide-down"
					role="region"
					aria-label="Log entry details"
				>
					{/* Full Message */}
					{isTruncated && (
						<div>
							<p className="text-xs text-neutral-400 mb-1">Full Message:</p>
							<p className="text-sm text-neutral-100 font-mono break-words">{log.message}</p>
						</div>
					)}

					{/* Error Code */}
					{log.error_code && (
						<div>
							<p className="text-xs text-neutral-400 mb-1">Error Code:</p>
							<code className="text-sm text-alert-error font-mono">{log.error_code}</code>
						</div>
					)}

					{/* Request ID */}
					{log.request_id && (
						<div>
							<p className="text-xs text-neutral-400 mb-1">Request ID:</p>
							<code className="text-sm text-neutral-100 font-mono">{log.request_id}</code>
						</div>
					)}

					{/* Metadata (JSON) */}
					{log.metadata && Object.keys(log.metadata).length > 0 && (
						<div>
							<p className="text-xs text-neutral-400 mb-1">Metadata:</p>
							<pre className="text-xs text-neutral-100 font-mono bg-surface-elevated p-2 rounded overflow-x-auto scrollbar-dark">
								{JSON.stringify(log.metadata, null, 2)}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
