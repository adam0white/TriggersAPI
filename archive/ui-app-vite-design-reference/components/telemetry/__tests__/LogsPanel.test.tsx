/**
 * Unit tests for LogsPanel component
 * Story 7.4: Telemetry Panels Upgrade
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogsPanel } from '../LogsPanel';
import { RunProvider } from '@/context/RunContext';

// Mock RunContext with a test run_id
const MockRunProvider = ({ children }: { children: React.ReactNode }) => {
	return <RunProvider>{children}</RunProvider>;
};

describe('LogsPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders without errors', () => {
		render(
			<MockRunProvider>
				<LogsPanel />
			</MockRunProvider>
		);

		expect(screen.getByRole('region', { name: /event logs/i })).toBeInTheDocument();
		expect(screen.getByText('Logs')).toBeInTheDocument();
	});

	it('shows empty state when no run is active', () => {
		render(
			<MockRunProvider>
				<LogsPanel />
			</MockRunProvider>
		);

		expect(screen.getByText(/no logs yet/i)).toBeInTheDocument();
		expect(screen.getByText(/run an event to see logs/i)).toBeInTheDocument();
	});

	it('displays filter controls', () => {
		render(
			<MockRunProvider>
				<LogsPanel />
			</MockRunProvider>
		);

		expect(screen.getByPlaceholderText(/search logs/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/filter by log level/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/filter by stage/i)).toBeInTheDocument();
	});

	it('displays action buttons', () => {
		render(
			<MockRunProvider>
				<LogsPanel />
			</MockRunProvider>
		);

		expect(screen.getByRole('button', { name: /copy all/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
	});

	it('action buttons are disabled when no logs', () => {
		render(
			<MockRunProvider>
				<LogsPanel />
			</MockRunProvider>
		);

		expect(screen.getByRole('button', { name: /copy all/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /download/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
	});

	it('applies custom className', () => {
		const { container } = render(
			<MockRunProvider>
				<LogsPanel className="custom-class" />
			</MockRunProvider>
		);

		const panel = container.querySelector('.custom-class');
		expect(panel).toBeInTheDocument();
	});

	it('has proper ARIA attributes', () => {
		render(
			<MockRunProvider>
				<LogsPanel />
			</MockRunProvider>
		);

		const region = screen.getByRole('region', { name: /event logs/i });
		expect(region).toBeInTheDocument();

		const logContainer = screen.getByRole('log');
		expect(logContainer).toHaveAttribute('aria-live', 'polite');
		expect(logContainer).toHaveAttribute('aria-relevant', 'additions');
	});
});
