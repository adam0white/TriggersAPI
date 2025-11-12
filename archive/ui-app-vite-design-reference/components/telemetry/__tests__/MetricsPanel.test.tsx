/**
 * MetricsPanel Unit Tests
 * Story 7.5: Metrics Pulse & Delivery Analysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricsPanel } from '../MetricsPanel';
import { RunProvider } from '@/context/RunContext';
import type { SessionMetrics, RunHistoryEntry } from '@/types/metrics';

// Mock RunContext
vi.mock('@/context/RunContext', () => ({
	RunProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	useRun: () => ({
		sessionMetrics: {
			totalEvents: 147,
			successRate: 98.2,
			successfulEvents: 144,
			failedEvents: 3,
			avgLatency: 342,
			latencyPercentiles: { p50: 320, p95: 480, p99: 720 },
			queueDepth: 2,
			dlqCount: 3,
			eventsPerMinute: [10, 15, 20, 25, 30],
			successRateTrend: [95, 96, 97, 98, 98.2],
			latencyTrend: [350, 345, 340, 338, 342],
			queueDepthTrend: [3, 2, 2, 1, 2],
			timestamp: new Date().toISOString(),
		} as SessionMetrics,
		runHistory: [
			{
				runId: 'run-123',
				status: 'success',
				type: 'default',
				timestamp: new Date().toISOString(),
				avgLatency: 340,
				eventCount: 1,
				payload: {},
				duration: 1000,
			},
			{
				runId: 'run-122',
				status: 'success',
				type: 'bulk',
				timestamp: new Date(Date.now() - 60000).toISOString(),
				avgLatency: 350,
				eventCount: 50,
				failedCount: 2,
				payload: {},
				duration: 5000,
			},
		] as RunHistoryEntry[],
	}),
}));

describe('MetricsPanel', () => {
	it('renders all metric tiles', () => {
		render(<MetricsPanel />);

		expect(screen.getByText('Total Events')).toBeInTheDocument();
		expect(screen.getByText('Success Rate')).toBeInTheDocument();
		expect(screen.getByText('Avg Latency')).toBeInTheDocument();
		expect(screen.getByText('Queue Depth')).toBeInTheDocument();
	});

	it('displays total events count', () => {
		render(<MetricsPanel />);

		expect(screen.getByText('147')).toBeInTheDocument();
	});

	it('displays success rate percentage', () => {
		render(<MetricsPanel />);

		expect(screen.getByText('98.2%')).toBeInTheDocument();
	});

	it('displays average latency', () => {
		render(<MetricsPanel />);

		expect(screen.getByText('342')).toBeInTheDocument();
	});

	it('displays queue depth', () => {
		render(<MetricsPanel />);

		expect(screen.getByText('2')).toBeInTheDocument();
	});

	it('renders DLQ widget with count', () => {
		render(<MetricsPanel />);

		expect(screen.getByText(/DLQ: 3 events/i)).toBeInTheDocument();
	});

	it('shows empty state when no history', () => {
		vi.mocked(vi.fn()).mockReturnValue({
			sessionMetrics: {
				totalEvents: 0,
				successRate: 0,
				successfulEvents: 0,
				failedEvents: 0,
				avgLatency: 0,
				latencyPercentiles: { p50: 0, p95: 0, p99: 0 },
				queueDepth: 0,
				dlqCount: 0,
				eventsPerMinute: [],
				successRateTrend: [],
				latencyTrend: [],
				queueDepthTrend: [],
				timestamp: new Date().toISOString(),
			},
			runHistory: [],
		});

		render(<MetricsPanel />);

		expect(screen.getByText('No metrics yet')).toBeInTheDocument();
	});
});
