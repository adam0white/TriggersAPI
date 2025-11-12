/**
 * Unit Tests for StageCard Component
 * Story 7.3: Event Timeline Canvas
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StageCard } from '../StageCard';
import type { StageState } from '@/types/runs';

describe('StageCard', () => {
	const baseStageState: StageState = {
		status: 'idle',
		timing: {
			start: null,
			end: null,
			duration_ms: null,
		},
	};

	it('renders idle state correctly', () => {
		render(
			<StageCard
				stage="ingress"
				stageState={baseStageState}
				isActive={false}
				isInteractive={false}
			/>
		);

		expect(screen.getByRole('region')).toBeInTheDocument();
		expect(screen.getByText('Ingress')).toBeInTheDocument();
		expect(screen.getByLabelText(/Ingress stage: not started/i)).toBeInTheDocument();
	});

	it('renders active state with spinner', () => {
		const activeState: StageState = {
			status: 'active',
			timing: {
				start: new Date().toISOString(),
				end: null,
				duration_ms: null,
			},
		};

		render(
			<StageCard
				stage="queue"
				stageState={activeState}
				isActive={true}
				isInteractive={true}
			/>
		);

		expect(screen.getByText('Queue')).toBeInTheDocument();
		expect(screen.getByLabelText(/Queue stage: in progress/i)).toBeInTheDocument();
	});

	it('renders success state with duration', () => {
		const successState: StageState = {
			status: 'success',
			timing: {
				start: new Date().toISOString(),
				end: new Date().toISOString(),
				duration_ms: 120,
			},
		};

		render(
			<StageCard
				stage="processing"
				stageState={successState}
				isActive={false}
				isInteractive={true}
			/>
		);

		expect(screen.getByText('Processing')).toBeInTheDocument();
		expect(screen.getByText('120ms')).toBeInTheDocument();
		expect(screen.getByLabelText(/Processing stage: completed in 120ms/i)).toBeInTheDocument();
	});

	it('renders error state with error message', () => {
		const errorState: StageState = {
			status: 'error',
			timing: {
				start: new Date().toISOString(),
				end: new Date().toISOString(),
				duration_ms: 50,
			},
			error: {
				code: 'VALIDATION_ERROR',
				message: 'Invalid payload format',
				log_snippet: 'Error at line 12: Missing required field',
			},
		};

		const onViewLogs = vi.fn();

		render(
			<StageCard
				stage="inbox"
				stageState={errorState}
				isActive={false}
				isInteractive={true}
				onViewLogs={onViewLogs}
			/>
		);

		expect(screen.getByText('Inbox')).toBeInTheDocument();
		expect(screen.getByText('VALIDATION_ERROR')).toBeInTheDocument();
		expect(screen.getByText('Invalid payload format')).toBeInTheDocument();
		expect(screen.getByText('View Logs')).toBeInTheDocument();
	});

	it('calls onViewLogs when View Logs button is clicked', async () => {
		const user = userEvent.setup();
		const onViewLogs = vi.fn();

		const errorState: StageState = {
			status: 'error',
			timing: {
				start: new Date().toISOString(),
				end: new Date().toISOString(),
				duration_ms: 50,
			},
			error: {
				code: 'ERROR',
				message: 'Test error',
			},
		};

		render(
			<StageCard
				stage="ingress"
				stageState={errorState}
				isActive={false}
				isInteractive={true}
				onViewLogs={onViewLogs}
			/>
		);

		const viewLogsButton = screen.getByText('View Logs');
		await user.click(viewLogsButton);

		expect(onViewLogs).toHaveBeenCalledTimes(1);
	});

	it('renders pending state correctly', () => {
		const pendingState: StageState = {
			status: 'pending',
			timing: {
				start: null,
				end: null,
				duration_ms: null,
			},
		};

		render(
			<StageCard
				stage="processing"
				stageState={pendingState}
				isActive={false}
				isInteractive={false}
			/>
		);

		expect(screen.getByText('Processing')).toBeInTheDocument();
		expect(screen.getByLabelText(/Processing stage: waiting for upstream/i)).toBeInTheDocument();
	});

	it('applies custom className', () => {
		const { container } = render(
			<StageCard
				stage="ingress"
				stageState={baseStageState}
				isActive={false}
				isInteractive={false}
				className="custom-class"
			/>
		);

		expect(container.querySelector('.custom-class')).toBeInTheDocument();
	});
});
