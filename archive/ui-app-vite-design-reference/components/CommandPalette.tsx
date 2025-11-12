/**
 * Command Palette Component
 * Story 7.6: UX Pattern Implementation
 *
 * Keyboard-driven command palette for quick navigation and actions.
 * Triggered by ⌘K (Mac) or Ctrl+K (Windows/Linux).
 *
 * Features:
 * - Navigation commands (scroll to panels)
 * - Run actions (trigger events, retry failed)
 * - Data export (JSON, CSV, clipboard)
 * - Debug utilities (clear logs, reset dashboard)
 * - Fuzzy search filtering
 * - Keyboard navigation (arrows, enter, esc)
 */

import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useToastHelpers } from '../context/ToastContext';

export interface CommandItem {
	id: string;
	name: string;
	category: 'Navigation' | 'Actions' | 'Export' | 'Debug';
	icon: string;
	shortcut?: string;
	action: () => void;
}

interface CommandPaletteProps {
	onRunDefault?: () => void;
	onRunBulk?: () => void;
	onRetryFailed?: () => void;
	onReplaySuccess?: () => void;
	onExportLogs?: (format: 'json' | 'csv') => void;
	onExportEvents?: () => void;
	onExportHistory?: () => void;
	onCopyLogs?: () => void;
	onClearLogs?: () => void;
	onClearDLQ?: () => void;
	onToggleDebug?: () => void;
	onResetDashboard?: () => void;
}

export function CommandPalette({
	onRunDefault,
	onRunBulk,
	onRetryFailed,
	onReplaySuccess,
	onExportLogs,
	onExportEvents,
	onExportHistory,
	onCopyLogs,
	onClearLogs,
	onClearDLQ,
	onToggleDebug,
	onResetDashboard,
}: CommandPaletteProps) {
	const [open, setOpen] = useState(false);
	const toast = useToastHelpers();

	// Define all commands
	const commands: CommandItem[] = [
		// Navigation
		{
			id: 'nav-logs',
			name: 'Go to Logs',
			category: 'Navigation',
			icon: '📋',
			action: () => {
				document.getElementById('logs-panel')?.scrollIntoView({ behavior: 'smooth' });
				setOpen(false);
			},
		},
		{
			id: 'nav-inbox',
			name: 'Go to Inbox',
			category: 'Navigation',
			icon: '📥',
			action: () => {
				document.getElementById('inbox-panel')?.scrollIntoView({ behavior: 'smooth' });
				setOpen(false);
			},
		},
		{
			id: 'nav-metrics',
			name: 'Go to Metrics',
			category: 'Navigation',
			icon: '📊',
			action: () => {
				document.getElementById('metrics-panel')?.scrollIntoView({ behavior: 'smooth' });
				setOpen(false);
			},
		},
		{
			id: 'nav-history',
			name: 'Go to History',
			category: 'Navigation',
			icon: '🕐',
			action: () => {
				document.getElementById('history-panel')?.scrollIntoView({ behavior: 'smooth' });
				setOpen(false);
			},
		},
		{
			id: 'nav-top',
			name: 'Back to Top',
			category: 'Navigation',
			icon: '⬆️',
			action: () => {
				window.scrollTo({ top: 0, behavior: 'smooth' });
				setOpen(false);
			},
		},

		// Run Actions
		{
			id: 'run-default',
			name: 'Run Default Event',
			category: 'Actions',
			icon: '▶️',
			action: () => {
				onRunDefault?.();
				setOpen(false);
				toast.info('Running default event...');
			},
		},
		{
			id: 'run-bulk',
			name: 'Run Bulk Event',
			category: 'Actions',
			icon: '⏩',
			action: () => {
				onRunBulk?.();
				setOpen(false);
				toast.info('Switched to batch mode');
			},
		},
		{
			id: 'retry-failed',
			name: 'Retry Last Failed',
			category: 'Actions',
			icon: '🔄',
			action: () => {
				onRetryFailed?.();
				setOpen(false);
				toast.info('Retrying last failed event...');
			},
		},
		{
			id: 'replay-success',
			name: 'Replay Last Successful',
			category: 'Actions',
			icon: '↩️',
			action: () => {
				onReplaySuccess?.();
				setOpen(false);
				toast.info('Replaying last successful run...');
			},
		},

		// Export
		{
			id: 'export-logs-json',
			name: 'Export Logs as JSON',
			category: 'Export',
			icon: '💾',
			action: () => {
				onExportLogs?.('json');
				setOpen(false);
				toast.success('Logs exported as JSON');
			},
		},
		{
			id: 'export-logs-csv',
			name: 'Export Logs as CSV',
			category: 'Export',
			icon: '📄',
			action: () => {
				onExportLogs?.('csv');
				setOpen(false);
				toast.success('Logs exported as CSV');
			},
		},
		{
			id: 'export-events',
			name: 'Export Events as JSON',
			category: 'Export',
			icon: '📦',
			action: () => {
				onExportEvents?.();
				setOpen(false);
				toast.success('Events exported');
			},
		},
		{
			id: 'export-history',
			name: 'Export History',
			category: 'Export',
			icon: '📜',
			action: () => {
				onExportHistory?.();
				setOpen(false);
				toast.success('History exported');
			},
		},
		{
			id: 'copy-logs',
			name: 'Copy All Logs',
			category: 'Export',
			icon: '📋',
			action: () => {
				onCopyLogs?.();
				setOpen(false);
				toast.success('Logs copied to clipboard');
			},
		},

		// Debug
		{
			id: 'clear-logs',
			name: 'Clear All Logs',
			category: 'Debug',
			icon: '🗑️',
			action: () => {
				onClearLogs?.();
				setOpen(false);
			},
		},
		{
			id: 'clear-dlq',
			name: 'Clear DLQ',
			category: 'Debug',
			icon: '🧹',
			action: () => {
				onClearDLQ?.();
				setOpen(false);
			},
		},
		{
			id: 'toggle-debug',
			name: 'Toggle Debug Mode',
			category: 'Debug',
			icon: '🐛',
			action: () => {
				onToggleDebug?.();
				setOpen(false);
				toast.info('Debug mode toggled');
			},
		},
		{
			id: 'reset-dashboard',
			name: 'Reset Dashboard',
			category: 'Debug',
			icon: '🔄',
			action: () => {
				onResetDashboard?.();
				setOpen(false);
			},
		},
	];

	// Keyboard shortcut listener
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, []);

	// Group commands by category
	const categories = ['Navigation', 'Actions', 'Export', 'Debug'] as const;

	return (
		<Command.Dialog
			open={open}
			onOpenChange={setOpen}
			label="Command Palette"
			className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
				bg-[#2B2358] border border-[rgba(255,253,249,0.1)] rounded-lg shadow-[var(--shadow-modal)]
				w-full max-w-[500px] max-h-[400px] overflow-hidden
				animate-slide-in"
		>
			{/* Overlay */}
			{open && (
				<div
					className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
					onClick={() => setOpen(false)}
				/>
			)}

			{/* Input */}
			<div className="flex items-center border-b border-[rgba(255,253,249,0.1)] px-4">
				<span className="text-lg mr-2" aria-hidden="true">
					🔍
				</span>
				<Command.Input
					placeholder="Search commands..."
					className="flex-1 py-3 bg-transparent text-[#FFFDF9] placeholder-[#FFF3E6]/50
						focus:outline-none text-sm"
				/>
			</div>

			{/* Results */}
			<Command.List className="max-h-[340px] overflow-y-auto scrollbar-dark p-2">
				<Command.Empty className="py-8 text-center text-[#FFF3E6] text-sm">
					No results found.
				</Command.Empty>

				{categories.map((category) => (
					<Command.Group
						key={category}
						heading={category}
						className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2
							[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-[#FFF3E6]/70
							[&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase
							[&_[cmdk-group-heading]]:tracking-wide"
					>
						{commands
							.filter((cmd) => cmd.category === category)
							.map((command) => (
								<Command.Item
									key={command.id}
									value={command.name}
									onSelect={() => command.action()}
									className="flex items-center justify-between px-2 py-2 rounded
										text-[#FFFDF9] text-sm cursor-pointer
										hover:bg-[rgba(255,253,249,0.1)]
										aria-selected:bg-[rgba(255,253,249,0.15)]
										transition-colors"
								>
									<div className="flex items-center gap-2">
										<span className="text-base" aria-hidden="true">
											{command.icon}
										</span>
										<span>{command.name}</span>
									</div>
									{command.shortcut && (
										<kbd
											className="px-2 py-0.5 text-xs bg-[rgba(255,253,249,0.1)]
											text-[#FFF3E6] rounded border border-[rgba(255,253,249,0.1)]"
										>
											{command.shortcut}
										</kbd>
									)}
								</Command.Item>
							))}
					</Command.Group>
				))}
			</Command.List>
		</Command.Dialog>
	);
}

/**
 * Floating button trigger for mobile (alternative to keyboard shortcut)
 */
export function CommandPaletteTrigger({ onClick }: { onClick: () => void }) {
	return (
		<button
			onClick={onClick}
			className="fixed bottom-4 right-4 z-40 md:hidden
				bg-[#FF4F00] text-white rounded-full w-12 h-12
				flex items-center justify-center shadow-lg
				hover:bg-[#E64600] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]
				transition-colors"
			aria-label="Open command palette"
		>
			⌘K
		</button>
	);
}
