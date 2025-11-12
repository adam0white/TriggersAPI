/**
 * Unit tests for InboxPanel component
 * Story 7.4: Telemetry Panels Upgrade
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InboxPanel } from '../InboxPanel';
import { RunProvider } from '@/context/RunContext';

// Mock RunContext with a test run_id
const MockRunProvider = ({ children }: { children: React.ReactNode }) => {
	return <RunProvider>{children}</RunProvider>;
};

describe('InboxPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders without errors', () => {
		render(
			<MockRunProvider>
				<InboxPanel />
			</MockRunProvider>
		);

		expect(screen.getByRole('region', { name: /event inbox/i })).toBeInTheDocument();
		expect(screen.getByText('Inbox')).toBeInTheDocument();
	});

	it('shows empty state when no run is active', () => {
		render(
			<MockRunProvider>
				<InboxPanel />
			</MockRunProvider>
		);

		expect(screen.getByText(/no events yet/i)).toBeInTheDocument();
		expect(screen.getByText(/run an event to populate the inbox/i)).toBeInTheDocument();
	});

	it('displays filter controls', () => {
		render(
			<MockRunProvider>
				<InboxPanel />
			</MockRunProvider>
		);

		expect(screen.getByPlaceholderText(/search by event id/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/filter by time range/i)).toBeInTheDocument();
	});

	it('displays table with proper structure', () => {
		render(
			<MockRunProvider>
				<InboxPanel />
			</MockRunProvider>
		);

		expect(screen.getByRole('table')).toBeInTheDocument();
		expect(screen.getByText('Event ID')).toBeInTheDocument();
		expect(screen.getByText('Status')).toBeInTheDocument();
		expect(screen.getByText('Timestamp')).toBeInTheDocument();
		expect(screen.getByText('Latency')).toBeInTheDocument();
		expect(screen.getByText('Actions')).toBeInTheDocument();
	});

	it('has select all checkbox in table header', () => {
		render(
			<MockRunProvider>
				<InboxPanel />
			</MockRunProvider>
		);

		const selectAllCheckbox = screen.getByLabelText(/select all events/i);
		expect(selectAllCheckbox).toBeInTheDocument();
	});

	it('applies custom className', () => {
		const { container } = render(
			<MockRunProvider>
				<InboxPanel className="custom-class" />
			</MockRunProvider>
		);

		const panel = container.querySelector('.custom-class');
		expect(panel).toBeInTheDocument();
	});

	it('has proper ARIA attributes', () => {
		render(
			<MockRunProvider>
				<InboxPanel />
			</MockRunProvider>
		);

		const region = screen.getByRole('region', { name: /event inbox/i });
		expect(region).toBeInTheDocument();

		const table = screen.getByRole('table');
		expect(table).toBeInTheDocument();
	});
});
