import React from 'react';
import { DashboardLayout, Column1, Column2, StickySection, ScrollableSection, TelemetryPanel } from '@/components/layouts';
import { RunCommandPanel } from '@/components/RunCommandPanel';
import { EventTimelineCanvas } from '@/components/EventTimeline';
import { LogsPanel, InboxPanel, MetricsPanel, HistoryPanel } from '@/components/telemetry';
import { CommandPalette } from '@/components/CommandPalette';

/**
 * Dashboard Page
 * Story 7.1/7.6: Main entry point for Mission-Control Pulse Dashboard
 *
 * Layout Structure:
 * - Two-column responsive layout
 * - Column 1: Sticky Run Command + Scrollable Timeline
 * - Column 2: Collapsible Telemetry Panels (Logs, Inbox, Metrics, History)
 * - Command Palette (⌘K) for quick actions (Story 7.6)
 *
 * Responsive Behavior:
 * - Desktop (≥1440px): Two columns side-by-side
 * - Tablet (768-1199px): Columns stack vertically
 * - Mobile (<768px): Single column with collapsed panels
 *
 * @see Story 7.1: Design Tokens & Layout Shell
 * @see Story 7.6: UX Pattern Implementation
 */

export function Dashboard() {
	// Command palette action handlers (placeholder implementations)
	const handleRunDefault = () => {
		// TODO: Trigger default run from RunCommandPanel
	};

	const handleRunBulk = () => {
		// TODO: Switch to batch mode
	};

	const handleExportLogs = (format: 'json' | 'csv') => {
		// TODO: Export logs
	};

	const handleClearLogs = () => {
		// TODO: Clear logs with confirmation
	};

	return (
		<DashboardLayout>
			{/* Command Palette - Global shortcut ⌘K */}
			<CommandPalette
				onRunDefault={handleRunDefault}
				onRunBulk={handleRunBulk}
				onExportLogs={handleExportLogs}
				onClearLogs={handleClearLogs}
			/>

			{/* Column 1: Primary Control Panel */}
			<Column1>
				{/* Sticky Run Command */}
				<StickySection>
					<RunCommandPanel />
				</StickySection>

				{/* Scrollable Timeline */}
				<ScrollableSection>
					<EventTimelineCanvas />
				</ScrollableSection>
			</Column1>

			{/* Column 2: Telemetry Stack */}
			<Column2 defaultExpanded="logs">
				{/* Logs Panel */}
				<TelemetryPanel
					id="logs-panel"
					title="Live Logs"
					icon={<span>📜</span>}
					badge={3}
				>
					<LogsPanel />
				</TelemetryPanel>

				{/* Inbox Panel */}
				<TelemetryPanel
					id="inbox-panel"
					title="Event Inbox"
					icon={<span>📨</span>}
					badge={12}
				>
					<InboxPanel />
				</TelemetryPanel>

				{/* Metrics Panel */}
				<TelemetryPanel
					id="metrics-panel"
					title="Metrics Pulse"
					icon={<span>📊</span>}
				>
					<MetricsPanel />
				</TelemetryPanel>

				{/* History Panel */}
				<TelemetryPanel
					id="history-panel"
					title="Run History"
					icon={<span>📚</span>}
					badge={25}
				>
					<HistoryPanel />
				</TelemetryPanel>
			</Column2>
		</DashboardLayout>
	);
}
