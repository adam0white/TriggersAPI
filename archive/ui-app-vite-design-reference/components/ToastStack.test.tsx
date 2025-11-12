/**
 * ToastStack Component Tests
 * Story 7.6: UX Pattern Implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/context/ToastContext';
import { ToastStack } from '../ToastStack';
import { useToastHelpers } from '@/context/ToastContext';
import React from 'react';

// Test component that uses toast
function TestToastTrigger() {
	const toast = useToastHelpers();

	return (
		<div>
			<button onClick={() => toast.success('Success message')}>Show Success</button>
			<button onClick={() => toast.error('Error message')}>Show Error</button>
			<button onClick={() => toast.warning('Warning message')}>Show Warning</button>
			<button onClick={() => toast.info('Info message')}>Show Info</button>
			<button
				onClick={() =>
					toast.success('With action', {
						label: 'Retry',
						onClick: () => console.log('Action clicked'),
					})
				}
			>
				Show With Action
			</button>
		</div>
	);
}

function TestWrapper({ children }: { children: React.ReactNode }) {
	return (
		<ToastProvider>
			{children}
			<ToastStack />
		</ToastProvider>
	);
}

describe('ToastStack', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('renders success toast with correct styling', async () => {
		const user = userEvent.setup({ delay: null });
		render(<TestToastTrigger />, { wrapper: TestWrapper });

		await user.click(screen.getByText('Show Success'));

		expect(screen.getByText('Success message')).toBeInTheDocument();
		expect(screen.getByRole('status')).toBeInTheDocument();
	});

	it('renders error toast with correct styling and role', async () => {
		const user = userEvent.setup({ delay: null });
		render(<TestToastTrigger />, { wrapper: TestWrapper });

		await user.click(screen.getByText('Show Error'));

		expect(screen.getByText('Error message')).toBeInTheDocument();
		expect(screen.getByRole('alert')).toBeInTheDocument();
	});

	it('auto-dismisses success toast after 4 seconds', async () => {
		const user = userEvent.setup({ delay: null });
		render(<TestToastTrigger />, { wrapper: TestWrapper });

		await user.click(screen.getByText('Show Success'));

		expect(screen.getByText('Success message')).toBeInTheDocument();

		// Fast-forward 4 seconds + animation time
		act(() => {
			vi.advanceTimersByTime(4150);
		});

		await waitFor(() => {
			expect(screen.queryByText('Success message')).not.toBeInTheDocument();
		});
	});

	it('does not auto-dismiss error toast', async () => {
		const user = userEvent.setup({ delay: null });
		render(<TestToastTrigger />, { wrapper: TestWrapper });

		await user.click(screen.getByText('Show Error'));

		expect(screen.getByText('Error message')).toBeInTheDocument();

		// Fast-forward 10 seconds
		act(() => {
			vi.advanceTimersByTime(10000);
		});

		// Error toast should still be visible
		expect(screen.getByText('Error message')).toBeInTheDocument();
	});

	it('allows manual dismiss via button', async () => {
		const user = userEvent.setup({ delay: null });
		render(<TestToastTrigger />, { wrapper: TestWrapper });

		await user.click(screen.getByText('Show Success'));

		expect(screen.getByText('Success message')).toBeInTheDocument();

		// Click dismiss button
		await user.click(screen.getByLabelText('Dismiss notification'));

		// Wait for fade-out animation
		act(() => {
			vi.advanceTimersByTime(150);
		});

		await waitFor(() => {
			expect(screen.queryByText('Success message')).not.toBeInTheDocument();
		});
	});

	it('renders action button and executes callback', async () => {
		const user = userEvent.setup({ delay: null });
		const consoleSpy = vi.spyOn(console, 'log');

		render(<TestToastTrigger />, { wrapper: TestWrapper });

		await user.click(screen.getByText('Show With Action'));

		expect(screen.getByText('With action')).toBeInTheDocument();
		expect(screen.getByText('Retry')).toBeInTheDocument();

		await user.click(screen.getByText('Retry'));

		expect(consoleSpy).toHaveBeenCalledWith('Action clicked');
	});

	it('shows max 3 toasts at once', async () => {
		const user = userEvent.setup({ delay: null });
		render(<TestToastTrigger />, { wrapper: TestWrapper });

		// Add 5 toasts
		await user.click(screen.getByText('Show Success'));
		await user.click(screen.getByText('Show Error'));
		await user.click(screen.getByText('Show Warning'));
		await user.click(screen.getByText('Show Info'));

		// Only 3 should be visible
		const toasts = screen.getAllByRole(/alert|status/);
		expect(toasts.length).toBeLessThanOrEqual(3);
	});
});
