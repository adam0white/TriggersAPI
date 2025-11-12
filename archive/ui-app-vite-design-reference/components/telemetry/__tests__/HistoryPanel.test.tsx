/**
 * HistoryPanel Unit Tests
 * Story 7.5: Metrics Pulse & Delivery Analysis
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryPanel } from '../HistoryPanel';
import type { RunHistoryEntry } from '@/types/metrics';

// Mock RunContext
vi.mock('@/context/RunContext', () => ({
	useRun: () => ({
		runHistory: [
			{
				runId: 'run-abc123',
				status: 'success',
				type: 'default',
				timestamp: new Date().toISOString(),
				avgLatency: 342,
				eventCount: 1,
				payload: { test: 'data' },
				duration: 1000,
			},
			{
				runId: 'run-def456',
				status: 'failed',
				type: 'debug',
				timestamp: new Date(Date.now() - 60000).toISOString(),
				avgLatency: 450,
				eventCount: 1,
				failedCount: 1,
				payload: { test: 'data2' },
				debugFlags: { trigger_validation_error: true },
				duration: 1500,
			},
			{
				runId: 'run-ghi789',
				status: 'partial',
				type: 'bulk',
				timestamp: new Date(Date.now() - 120000).toISOString(),
				avgLatency: 380,
				eventCount: 50,
				failedCount: 5,
				payload: { batch: true },
				duration: 5000,
			},
		] as RunHistoryEntry[],
	}),
}));

describe('HistoryPanel', () => {
	it('renders run history list', () => {
		render(<HistoryPanel />);

		expect(screen.getByText(/run-abc123/i)).toBeInTheDocument();
		expect(screen.getByText(/run-def456/i)).toBeInTheDocument();
		expect(screen.getByText(/run-ghi789/i)).toBeInTheDocument();
	});

	it('displays status badges', () => {
		render(<HistoryPanel />);

		expect(screen.getByText('success')).toBeInTheDocument();
		expect(screen.getByText('failed')).toBeInTheDocument();
		expect(screen.getByText('partial')).toBeInTheDocument();
	});

	it('shows latency for each run', () => {
		render(<HistoryPanel />);

		expect(screen.getByText('342ms avg')).toBeInTheDocument();
		expect(screen.getByText('450ms avg')).toBeInTheDocument();
		expect(screen.getByText('380ms avg')).toBeInTheDocument();
	});

	it('displays event counts for bulk runs', () => {
		render(<HistoryPanel />);

		expect(screen.getByText('50 events')).toBeInTheDocument();
	});

	it('shows failed counts when present', () => {
		render(<HistoryPanel />);

		expect(screen.getByText('1 failed')).toBeInTheDocument();
		expect(screen.getByText('5 failed')).toBeInTheDocument();
	});

	it('renders replay buttons', () => {
		render(<HistoryPanel />);

		const replayButtons = screen.getAllByRole('button', { name: /Replay run/i });
		expect(replayButtons).toHaveLength(3);
	});

	it('calls onReplay when replay button is clicked', () => {
		const onReplay = vi.fn();
		render(<HistoryPanel onReplay={onReplay} />);

		const replayButtons = screen.getAllByRole('button', { name: /Replay run run-abc123/i });
		fireEvent.click(replayButtons[0]);

		expect(onReplay).toHaveBeenCalledWith(
			expect.objectContaining({
				runId: 'run-abc123',
				status: 'success',
			})
		);
	});

	it('filters by status', () => {
		render(<HistoryPanel />);

		const statusFilter = screen.getByLabelText('Filter by status');
		fireEvent.change(statusFilter, { target: { value: 'success' } });

		expect(screen.getByText(/run-abc123/i)).toBeInTheDocument();
		expect(screen.queryByText(/run-def456/i)).not.toBeInTheDocument();
	});

	it('filters by type', () => {
		render(<HistoryPanel />);

		const typeFilter = screen.getByLabelText('Filter by type');
		fireEvent.change(typeFilter, { target: { value: 'bulk' } });

		expect(screen.getByText(/run-ghi789/i)).toBeInTheDocument();
		expect(screen.queryByText(/run-abc123/i)).not.toBeInTheDocument();
	});

	it('searches by run ID', () => {
		render(<HistoryPanel />);

		const searchInput = screen.getByLabelText('Search runs by ID');
		fireEvent.change(searchInput, { target: { value: 'abc' } });

		expect(screen.getByText(/run-abc123/i)).toBeInTheDocument();
		expect(screen.queryByText(/run-def456/i)).not.toBeInTheDocument();
	});

	it('expands run details on button click', () => {
		render(<HistoryPanel />);

		const expandButtons = screen.getAllByRole('button', { name: /Expand run details/i });
		fireEvent.click(expandButtons[0]);

		expect(screen.getByText('Payload:')).toBeInTheDocument();
		expect(screen.getByText(/"test": "data"/i)).toBeInTheDocument();
	});

	it('shows empty state when no runs match filters', () => {
		render(<HistoryPanel />);

		const searchInput = screen.getByLabelText('Search runs by ID');
		fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

		expect(screen.getByText('No runs found')).toBeInTheDocument();
		expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
	});
});
