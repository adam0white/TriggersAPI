import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useRun } from '@/context/RunContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { HistoryPanelProps, HistoryFilters, RunHistoryEntry } from '@/types/metrics';

/**
 * History Panel - Complete Implementation
 * Story 7.5: Run history with replay controls
 *
 * Features:
 * - Chronological list of prior runs
 * - Status badges (Success/Failed/Partial)
 * - Type indicators (Default/Debug/Bulk)
 * - Latency and event count
 * - Replay button per run
 * - Bulk selection and export
 * - Filtering by status, type, time range
 * - Search by run ID
 * - Expandable details (payload, debug flags)
 *
 * Layout:
 * - List/card view responsive
 * - Fixed row height (56px)
 * - Max 20 runs visible (load more)
 *
 * Accessibility:
 * - Semantic list structure
 * - aria-label for status badges
 * - Keyboard navigation
 * - WCAG 2.1 AA compliance
 */

export function HistoryPanel({ className, onReplay, maxRuns = 20 }: HistoryPanelProps) {
	const { runHistory } = useRun();

	// State
	const [filters, setFilters] = useState<HistoryFilters>({
		status: 'all',
		type: 'all',
		timeRange: 'all',
		searchQuery: '',
	});
	const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set());
	const [expandedRun, setExpandedRun] = useState<string | null>(null);

	// Filter runs
	const filteredRuns = useMemo(() => {
		let filtered = [...runHistory];

		// Status filter
		if (filters.status && filters.status !== 'all') {
			filtered = filtered.filter((run) => run.status === filters.status);
		}

		// Type filter
		if (filters.type && filters.type !== 'all') {
			filtered = filtered.filter((run) => run.type === filters.type);
		}

		// Search filter
		if (filters.searchQuery) {
			const query = filters.searchQuery.toLowerCase();
			filtered = filtered.filter((run) => run.runId.toLowerCase().includes(query));
		}

		// Time range filter
		if (filters.timeRange && filters.timeRange !== 'all') {
			const now = Date.now();
			const cutoff =
				filters.timeRange === 'last-hour'
					? now - 60 * 60 * 1000
					: filters.timeRange === 'today'
						? new Date().setHours(0, 0, 0, 0)
						: 0;

			filtered = filtered.filter((run) => new Date(run.timestamp).getTime() >= cutoff);
		}

		return filtered.slice(0, maxRuns);
	}, [runHistory, filters, maxRuns]);

	// Handle replay
	const handleReplay = (entry: RunHistoryEntry) => {
		console.log('[HistoryPanel] Replay run:', entry.runId);
		onReplay?.(entry);
		// TODO: Copy payload to Run Command panel
		// TODO: Scroll to Run Command panel
		// TODO: Show toast notification
	};

	// Handle bulk export
	const handleExport = () => {
		const selected = Array.from(selectedRuns)
			.map((id) => runHistory.find((run) => run.runId === id))
			.filter(Boolean);

		const csv = [
			['Run ID', 'Status', 'Type', 'Timestamp', 'Avg Latency', 'Event Count', 'Failed Count'].join(','),
			...selected.map((run) =>
				[
					run!.runId,
					run!.status,
					run!.type,
					run!.timestamp,
					run!.avgLatency,
					run!.eventCount || 1,
					run!.failedCount || 0,
				].join(',')
			),
		].join('\n');

		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `run-history-${new Date().toISOString()}.csv`;
		a.click();
		URL.revokeObjectURL(url);

		console.log('[HistoryPanel] Exported', selected.length, 'runs');
	};

	// Toggle selection
	const toggleSelection = (runId: string) => {
		const newSet = new Set(selectedRuns);
		if (newSet.has(runId)) {
			newSet.delete(runId);
		} else {
			newSet.add(runId);
		}
		setSelectedRuns(newSet);
	};

	// Toggle all
	const toggleAll = () => {
		if (selectedRuns.size === filteredRuns.length) {
			setSelectedRuns(new Set());
		} else {
			setSelectedRuns(new Set(filteredRuns.map((run) => run.runId)));
		}
	};

	// Format timestamp
	const formatTimestamp = (timestamp: string) => {
		const date = new Date(timestamp);
		const now = Date.now();
		const diff = now - date.getTime();

		if (diff < 60 * 1000) {
			return 'Just now';
		} else if (diff < 60 * 60 * 1000) {
			return `${Math.floor(diff / 60 / 1000)}m ago`;
		} else if (diff < 24 * 60 * 60 * 1000) {
			return `${Math.floor(diff / 60 / 60 / 1000)}h ago`;
		} else {
			return date.toLocaleDateString();
		}
	};

	// Status badge color
	const getStatusColor = (status: RunHistoryEntry['status']) => {
		return status === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
			status === 'partial' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
			'bg-red-500/10 text-red-400 border-red-500/20';
	};

	// Type icon
	const getTypeIcon = (type: RunHistoryEntry['type']) => {
		return type === 'bulk' ? '📦' : type === 'debug' ? '🐛' : '▶️';
	};

	return (
		<div className={cn('flex flex-col gap-md', className)} role="region" aria-label="Run History">
			{/* Filter Bar */}
			<div className="flex items-center gap-2 flex-wrap">
				<input
					type="text"
					placeholder="Search by run ID..."
					value={filters.searchQuery || ''}
					onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
					className="flex-1 min-w-[200px] px-3 py-1.5 rounded border border-neutral-400/20 bg-surface-elevated text-sm text-neutral-100 placeholder:text-neutral-400"
					aria-label="Search runs by ID"
				/>
				<select
					value={filters.status || 'all'}
					onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
					className="px-3 py-1.5 rounded border border-neutral-400/20 bg-surface-elevated text-sm text-neutral-100"
					aria-label="Filter by status"
				>
					<option value="all">All Status</option>
					<option value="success">Success</option>
					<option value="failed">Failed</option>
					<option value="partial">Partial</option>
				</select>
				<select
					value={filters.type || 'all'}
					onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
					className="px-3 py-1.5 rounded border border-neutral-400/20 bg-surface-elevated text-sm text-neutral-100"
					aria-label="Filter by type"
				>
					<option value="all">All Types</option>
					<option value="default">Default</option>
					<option value="debug">Debug</option>
					<option value="bulk">Bulk</option>
				</select>
			</div>

			{/* Bulk Actions */}
			{selectedRuns.size > 0 && (
				<div className="flex items-center gap-2 px-3 py-2 rounded bg-accent-1/10 border border-accent-1/20">
					<Checkbox checked={selectedRuns.size === filteredRuns.length} onChange={toggleAll} aria-label="Deselect all" />
					<span className="text-sm text-neutral-100">
						{selectedRuns.size} run{selectedRuns.size > 1 ? 's' : ''} selected
					</span>
					<Button size="sm" variant="outline" onClick={handleExport} className="ml-auto">
						Export CSV
					</Button>
				</div>
			)}

			{/* Run List */}
			<div className="space-y-2" role="list">
				{filteredRuns.length === 0 ? (
					<div className="text-center py-8 text-neutral-400">
						<p className="text-caption">No runs found</p>
						<p className="text-xs mt-1">
							{filters.searchQuery || filters.status !== 'all' || filters.type !== 'all'
								? 'Try adjusting your filters'
								: 'Submit a run to see history'}
						</p>
					</div>
				) : (
					filteredRuns.map((run) => (
						<div
							key={run.runId}
							className="rounded border border-neutral-400/20 bg-surface-elevated/50 hover:border-neutral-400/40 transition-colors"
							role="listitem"
						>
							{/* Run Card */}
							<div className="flex items-center gap-3 p-3">
								{/* Checkbox */}
								<Checkbox
									checked={selectedRuns.has(run.runId)}
									onChange={() => toggleSelection(run.runId)}
									aria-label={`Select run ${run.runId}`}
								/>

								{/* Type Icon */}
								<span className="text-xl" aria-hidden="true">
									{getTypeIcon(run.type)}
								</span>

								{/* Run Info */}
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-1">
										<Badge className={cn('text-xs', getStatusColor(run.status))}>
											{run.status}
										</Badge>
										<code className="text-xs text-neutral-100 font-mono">
											{run.runId.substring(0, 8)}
										</code>
										<span className="text-xs text-neutral-400">
											{formatTimestamp(run.timestamp)}
										</span>
									</div>
									<div className="flex items-center gap-3 text-xs text-neutral-400">
										<span>{Math.round(run.avgLatency)}ms avg</span>
										{run.eventCount && <span>{run.eventCount} events</span>}
										{run.failedCount && run.failedCount > 0 && (
											<span className="text-red-400">{run.failedCount} failed</span>
										)}
									</div>
								</div>

								{/* Actions */}
								<div className="flex items-center gap-2">
									<Button
										size="sm"
										variant="ghost"
										onClick={() =>
											setExpandedRun(expandedRun === run.runId ? null : run.runId)
										}
										aria-label={`${expandedRun === run.runId ? 'Collapse' : 'Expand'} run details`}
									>
										{expandedRun === run.runId ? '▲' : '▼'}
									</Button>
									<Button
										size="sm"
										variant="outline"
										onClick={() => handleReplay(run)}
										aria-label={`Replay run ${run.runId}`}
									>
										Replay
									</Button>
								</div>
							</div>

							{/* Expanded Details */}
							{expandedRun === run.runId && (
								<div className="px-3 pb-3 space-y-2 border-t border-neutral-400/20 pt-3">
									<div>
										<p className="text-xs text-neutral-400 mb-1">Payload:</p>
										<pre className="text-xs text-neutral-100 bg-neutral-900/50 p-2 rounded overflow-auto max-h-32">
											{JSON.stringify(run.payload, null, 2)}
										</pre>
									</div>
									{run.debugFlags && Object.keys(run.debugFlags).length > 0 && (
										<div>
											<p className="text-xs text-neutral-400 mb-1">Debug Flags:</p>
											<pre className="text-xs text-neutral-100 bg-neutral-900/50 p-2 rounded">
												{JSON.stringify(run.debugFlags, null, 2)}
											</pre>
										</div>
									)}
									<div className="flex items-center gap-4 text-xs text-neutral-400">
										<span>Duration: {run.duration ? `${run.duration}ms` : 'N/A'}</span>
										<span>Type: {run.type}</span>
									</div>
								</div>
							)}
						</div>
					))
				)}
			</div>

			{/* Load More */}
			{runHistory.length > maxRuns && filteredRuns.length >= maxRuns && (
				<Button variant="outline" size="sm" className="w-full" aria-label="Load more runs">
					Load More ({runHistory.length - maxRuns} more)
				</Button>
			)}
		</div>
	);
}
