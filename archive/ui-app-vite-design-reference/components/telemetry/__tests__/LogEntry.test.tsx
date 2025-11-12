/**
 * Unit tests for LogEntry component
 * Story 7.4: Telemetry Panels Upgrade
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogEntry, type LogEntryData } from '../LogEntry';

const mockLog: LogEntryData = {
	id: 'log-123',
	timestamp: new Date().toISOString(),
	level: 'info',
	message: 'Test log message',
	stage: 'ingress',
};

describe('LogEntry', () => {
	it('renders log message correctly', () => {
		render(<LogEntry log={mockLog} />);

		expect(screen.getByText(/test log message/i)).toBeInTheDocument();
	});

	it('displays correct log level badge', () => {
		render(<LogEntry log={mockLog} />);

		const badge = screen.getByLabelText(/log level: info/i);
		expect(badge).toBeInTheDocument();
		expect(badge).toHaveTextContent('INFO');
	});

	it('displays stage label', () => {
		render(<LogEntry log={mockLog} />);

		expect(screen.getByText('ingress')).toBeInTheDocument();
	});

	it('shows relative timestamp', () => {
		render(<LogEntry log={mockLog} />);

		// Should show relative time like "0s ago" for recent timestamp
		expect(screen.getByText(/ago/i)).toBeInTheDocument();
	});

	it('shows expand button for long messages', () => {
		const longLog: LogEntryData = {
			...mockLog,
			message: 'A'.repeat(250), // Long message > 200 chars
		};

		render(<LogEntry log={longLog} />);

		expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
	});

	it('expands on button click', async () => {
		const user = userEvent.setup();
		const logWithMetadata: LogEntryData = {
			...mockLog,
			message: 'A'.repeat(250),
			metadata: { key: 'value' },
		};

		render(<LogEntry log={logWithMetadata} />);

		const expandButton = screen.getByRole('button', { name: /expand/i });
		await user.click(expandButton);

		expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument();
	});

	it('displays error code when present', async () => {
		const user = userEvent.setup();
		const errorLog: LogEntryData = {
			...mockLog,
			level: 'error',
			message: 'Error occurred',
			error_code: 'ERR_VALIDATION',
			metadata: {},
		};

		render(<LogEntry log={errorLog} />);

		const expandButton = screen.getByRole('button', { name: /expand/i });
		await user.click(expandButton);

		expect(screen.getByText('Error Code:')).toBeInTheDocument();
		expect(screen.getByText('ERR_VALIDATION')).toBeInTheDocument();
	});

	it('applies highlight class when isNew is true', () => {
		const { container } = render(<LogEntry log={mockLog} isNew={true} />);

		const article = container.querySelector('[role="article"]');
		expect(article).toHaveClass('animate-pulse-highlight');
	});

	it('has proper ARIA attributes', () => {
		render(<LogEntry log={mockLog} />);

		const article = screen.getByRole('article');
		expect(article).toHaveAttribute('aria-label', expect.stringContaining('Log entry'));
	});
});
