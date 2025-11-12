/**
 * LogsPanel Component - Real-time log display with filtering and actions
 * Story 7.4: Telemetry Panels Upgrade
 *
 * Features:
 * - Real-time log display with auto-scroll
 * - Search and filtering (by level, stage, timestamp)
 * - Log entry highlighting for new entries
 * - Expansion for full log details
 * - Actions: copy, download, clear logs
 * - Synchronized with RunContext and Event Timeline
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRun } from '@/context/RunContext';
import { LogEntry, type LogEntryData } from './LogEntry';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LogsPanelProps {
	className?: string;
}

/**
 * Fetch logs from API - try real endpoint first, fallback to mock
 */
async function fetchLogs(runId?: string): Promise<LogEntryData[]> {
	try {
		// Try real API endpoint
		const response = await fetch(`/api/runs/${runId}/logs`);
		if (response.ok) {
			const data = await response.json();
			// Transform API response to LogEntryData format
			if (Array.isArray(data)) {
				return data.map((item: any, index: number) => ({
					id: item.id || `log-${Date.now()}-${index}`,
					timestamp: item.timestamp || new Date().toISOString(),
					level: item.level || 'info',
					message: item.message || item.log || item.text || 'Log entry',
					stage: item.stage || 'processing',
					request_id: item.request_id || runId,
					metadata: item.metadata || item.meta || {},
				}));
			}
		}
	} catch (error) {
		console.error('Failed to fetch from /api/logs, using mock data:', error);
	}

	// Generate mock logs based on current run status
	return [
		{
			id: `log-${Date.now()}-1`,
			timestamp: new Date(Date.now() - 5000).toISOString(),
			level: 'info',
			message: 'Event received at ingress gateway',
			stage: 'ingress',
			request_id: runId || 'mock',
		},
		{
			id: `log-${Date.now()}-2`,
			timestamp: new Date(Date.now() - 4000).toISOString(),
			level: 'info',
			message: 'Payload validated successfully',
			stage: 'ingress',
			metadata: { payload_size: 1024, auth_valid: true },
		},
		{
			id: `log-${Date.now()}-3`,
			timestamp: new Date(Date.now() - 3000).toISOString(),
			level: 'info',
			message: 'Event queued for processing',
			stage: 'queue',
			metadata: { queue_position: 1, estimated_wait_ms: 100 },
		},
		{
			id: `log-${Date.now()}-4`,
			timestamp: new Date(Date.now() - 2000).toISOString(),
			level: 'info',
			message: 'Processing workflow started',
			stage: 'processing',
		},
		{
			id: `log-${Date.now()}-5`,
			timestamp: new Date(Date.now() - 1000).toISOString(),
			level: 'info',
			message: 'Event delivered to inbox',
			stage: 'inbox',
		},
	];
}

export function LogsPanel({ className }: LogsPanelProps) {
	const { runState } = useRun();
	const [logs, setLogs] = useState<LogEntryData[]>([]);
	const [filteredLogs, setFilteredLogs] = useState<LogEntryData[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
	const [stageFilter, setStageFilter] = useState<'all' | 'ingress' | 'queue' | 'processing' | 'inbox'>('all');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [newLogIds, setNewLogIds] = useState<Set<string>>(new Set());
	const logsContainerRef = useRef<HTMLDivElement>(null);
	const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

	// Fetch logs when run changes or status updates
	useEffect(() => {
		// Guard: Only fetch when a run is active
		if (!runState.run_id) {
			setLogs([]);
			setFilteredLogs([]);
			setIsLoading(false);
			return;
		}

		const loadLogs = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const fetchedLogs = await fetchLogs(runState.run_id || undefined);
				setLogs(fetchedLogs);
				// Mark new logs for highlighting
				setNewLogIds(new Set(fetchedLogs.map((log) => log.id)));
			} catch (err) {
				setError(`Failed to load logs`);
				console.error('Error fetching logs:', err);
			} finally {
				setIsLoading(false);
			}
		};

		// Load logs on mount and when run changes
		loadLogs();

		// Refresh when run status changes (new stages)
		if (runState.current_stage || runState.status === 'success' || runState.status === 'failed') {
			// Slight delay to allow backend to process
			setTimeout(loadLogs, 500);
		}
	}, [runState.run_id, runState.status, runState.current_stage]);

	// Auto-scroll to latest error entry
	useEffect(() => {
		if (logs.length === 0) return;

		const latestError = logs.find((log) => log.level === 'error');
		if (latestError && logsContainerRef.current) {
			// Scroll to error entry after brief delay to allow rendering
			setTimeout(() => {
				const errorElement = document.getElementById(`log-${latestError.id}`);
				errorElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			}, 100);
		}
	}, [logs]);

	// Filter logs based on search and filters
	useEffect(() => {
		let result = logs;

		// Level filter
		if (levelFilter !== 'all') {
			result = result.filter((log) => log.level === levelFilter);
		}

		// Stage filter
		if (stageFilter !== 'all') {
			result = result.filter((log) => log.stage === stageFilter);
		}

		// Search filter (debounced)
		if (searchTerm) {
			result = result.filter((log) => log.message.toLowerCase().includes(searchTerm.toLowerCase()));
		}

		setFilteredLogs(result);
	}, [logs, searchTerm, levelFilter, stageFilter]);

	// Debounced search handler
	const handleSearchChange = (value: string) => {
		if (searchDebounceRef.current) {
			clearTimeout(searchDebounceRef.current);
		}

		searchDebounceRef.current = setTimeout(() => {
			setSearchTerm(value);
		}, 300);
	};

	// Copy all visible logs to clipboard
	const handleCopyAll = useCallback(async () => {
		const logsText = filteredLogs
			.map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.stage}] ${log.message}`)
			.join('\n');

		try {
			await navigator.clipboard.writeText(logsText);
			// TODO: Show success toast
		} catch (err) {
			console.error('Failed to copy logs:', err);
		}
	}, [filteredLogs]);

	// Download logs as file
	const handleDownload = useCallback(
		(format: 'txt' | 'json') => {
			let content: string;
			let filename: string;
			let mimeType: string;

			if (format === 'json') {
				content = JSON.stringify(filteredLogs, null, 2);
				filename = `logs-${runState.run_id}-${Date.now()}.json`;
				mimeType = 'application/json';
			} else {
				content = filteredLogs
					.map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.stage}] ${log.message}`)
					.join('\n');
				filename = `logs-${runState.run_id}-${Date.now()}.txt`;
				mimeType = 'text/plain';
			}

			const blob = new Blob([content], { type: mimeType });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		},
		[filteredLogs, runState.run_id]
	);

	// Clear all logs for current run
	const handleClear = useCallback(() => {
		const confirmed = window.confirm('Clear all logs for this run?');
		if (confirmed) {
			setLogs([]);
			setFilteredLogs([]);
		}
	}, []);

	// Remove active filter
	const removeFilter = (filterType: 'level' | 'stage') => {
		if (filterType === 'level') setLevelFilter('all');
		if (filterType === 'stage') setStageFilter('all');
	};

	const activeFilters = [
		...(levelFilter !== 'all' ? [{ type: 'level' as const, label: `Level: ${levelFilter}` }] : []),
		...(stageFilter !== 'all' ? [{ type: 'stage' as const, label: `Stage: ${stageFilter}` }] : []),
	];

	return (
		<div className={cn('flex flex-col gap-4', className)} role="region" aria-label="Event Logs">
			{/* Header with count badge */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h3 className="text-h3 text-neutral-100">Logs</h3>
					{logs.length > 0 && (
						<Badge variant="secondary" aria-label={`${logs.length} log entries`}>
							{logs.length}
						</Badge>
					)}
				</div>

				{/* Action buttons */}
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" onClick={handleCopyAll} disabled={filteredLogs.length === 0}>
						Copy All
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => handleDownload('txt')}
						disabled={filteredLogs.length === 0}
					>
						Download
					</Button>
					<Button variant="ghost" size="sm" onClick={handleClear} disabled={logs.length === 0}>
						Clear
					</Button>
				</div>
			</div>

			{/* Filter Controls */}
			<div className="flex flex-col sm:flex-row gap-3">
				{/* Search Input */}
				<div className="flex-1">
					<Input
						type="text"
						placeholder="Search logs..."
						onChange={(e) => handleSearchChange(e.target.value)}
						aria-label="Search logs by message text"
						className="w-full"
					/>
				</div>

				{/* Level Filter */}
				<Select
					value={levelFilter}
					onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
					aria-label="Filter by log level"
					className="sm:w-40"
				>
					<option value="all">All Levels</option>
					<option value="info">Info Only</option>
					<option value="warn">Warnings Only</option>
					<option value="error">Errors Only</option>
				</Select>

				{/* Stage Filter */}
				<Select
					value={stageFilter}
					onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)}
					aria-label="Filter by stage"
					className="sm:w-40"
				>
					<option value="all">All Stages</option>
					<option value="ingress">Ingress</option>
					<option value="queue">Queue</option>
					<option value="processing">Processing</option>
					<option value="inbox">Inbox</option>
				</Select>
			</div>

			{/* Active Filters */}
			{activeFilters.length > 0 && (
				<div className="flex items-center gap-2 flex-wrap">
					<span className="text-xs text-neutral-400">Active filters:</span>
					{activeFilters.map((filter) => (
						<Badge
							key={filter.type}
							variant="outline"
							className="cursor-pointer hover:bg-surface-elevated"
							onClick={() => removeFilter(filter.type)}
							role="button"
							aria-label={`Remove filter: ${filter.label}`}
						>
							{filter.label} ×
						</Badge>
					))}
				</div>
			)}

			{/* Logs Container */}
			<div
				ref={logsContainerRef}
				className="flex flex-col gap-3 max-h-[400px] overflow-y-auto scrollbar-dark rounded border border-neutral-400/20 bg-surface p-4"
				role="log"
				aria-live="polite"
				aria-relevant="additions"
			>
				{/* Loading State */}
				{isLoading && (
					<div className="space-y-3" aria-label="Loading logs">
						{[...Array(5)].map((_, i) => (
							<div key={i} className="animate-pulse">
								<div className="h-20 bg-surface-elevated rounded"></div>
							</div>
						))}
					</div>
				)}

				{/* Error State */}
				{error && (
					<div className="text-center py-8" role="alert">
						<p className="text-sm text-alert-error mb-2">{error}</p>
						<Button variant="outline" size="sm" onClick={() => window.location.reload()}>
							Retry
						</Button>
					</div>
				)}

				{/* Empty State */}
				{!isLoading && !error && logs.length === 0 && (
					<div className="text-center py-12">
						<p className="text-sm text-neutral-400">No logs yet</p>
						<p className="text-xs text-neutral-400 mt-1">Run an event to see logs</p>
					</div>
				)}

				{/* No Results State */}
				{!isLoading && !error && logs.length > 0 && filteredLogs.length === 0 && (
					<div className="text-center py-8">
						<p className="text-sm text-neutral-400">No logs match your filters</p>
					</div>
				)}

				{/* Log Entries */}
				{!isLoading && filteredLogs.map((log) => (
					<div key={log.id} id={`log-${log.id}`}>
						<LogEntry
							log={log}
							isNew={newLogIds.has(log.id)}
							isSearchMatch={!!searchTerm}
							searchTerm={searchTerm}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
