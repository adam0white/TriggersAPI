/**
 * EmptyState Component Tests
 * Story 7.6: UX Pattern Implementation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	EmptyState,
	LogsEmptyState,
	InboxEmptyState,
	MetricsEmptyState,
	HistoryEmptyState,
} from '../EmptyState';

describe('EmptyState', () => {
	it('renders icon, heading, and message', () => {
		render(<EmptyState icon="📋" heading="No Data" message="Nothing to show here" />);

		expect(screen.getByText('📋')).toBeInTheDocument();
		expect(screen.getByText('No Data')).toBeInTheDocument();
		expect(screen.getByText('Nothing to show here')).toBeInTheDocument();
	});

	it('renders action button when provided', () => {
		const onClick = vi.fn();
		render(
			<EmptyState
				icon="📋"
				heading="No Data"
				message="Nothing to show"
				action={{ label: 'Create New', onClick }}
			/>,
		);

		expect(screen.getByRole('button', { name: 'Create New' })).toBeInTheDocument();
	});

	it('calls action onClick when button clicked', async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();

		render(
			<EmptyState
				icon="📋"
				heading="No Data"
				message="Nothing to show"
				action={{ label: 'Create New', onClick }}
			/>,
		);

		await user.click(screen.getByRole('button', { name: 'Create New' }));

		expect(onClick).toHaveBeenCalled();
	});

	it('renders sub-message when provided', () => {
		render(
			<EmptyState
				icon="📋"
				heading="No Data"
				message="Nothing to show"
				subMessage="Press ⌘K for shortcuts"
			/>,
		);

		expect(screen.getByText('Press ⌘K for shortcuts')).toBeInTheDocument();
	});
});

describe('LogsEmptyState', () => {
	it('renders logs empty state with correct message', () => {
		render(<LogsEmptyState />);

		expect(screen.getByText('No logs yet')).toBeInTheDocument();
		expect(
			screen.getByText(
				/Run an event to see logs. Logs will appear here as your event moves through the pipeline./,
			),
		).toBeInTheDocument();
	});

	it('renders action button when onRunEvent provided', async () => {
		const user = userEvent.setup();
		const onRunEvent = vi.fn();

		render(<LogsEmptyState onRunEvent={onRunEvent} />);

		await user.click(screen.getByRole('button', { name: /run default event/i }));

		expect(onRunEvent).toHaveBeenCalled();
	});
});

describe('InboxEmptyState', () => {
	it('renders inbox empty state', () => {
		render(<InboxEmptyState />);

		expect(screen.getByText('Inbox is empty')).toBeInTheDocument();
	});
});

describe('MetricsEmptyState', () => {
	it('renders metrics empty state', () => {
		render(<MetricsEmptyState />);

		expect(screen.getByText('No metrics available')).toBeInTheDocument();
	});
});

describe('HistoryEmptyState', () => {
	it('renders history empty state', () => {
		render(<HistoryEmptyState />);

		expect(screen.getByText('No run history')).toBeInTheDocument();
	});
});
