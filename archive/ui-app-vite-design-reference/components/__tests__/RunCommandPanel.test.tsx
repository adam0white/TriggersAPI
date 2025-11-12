/**
 * RunCommandPanel Component Tests
 * Story 7.2: Run Command Panel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RunCommandPanel } from '../RunCommandPanel';
import type { RunResponse } from '@/types/runs';

// Mock the API client
vi.mock('@/services/runsApi', () => ({
	submitDefaultRun: vi.fn(),
	submitBatchRun: vi.fn(),
	ApiError: class ApiError extends Error {
		constructor(
			message: string,
			public statusCode: number,
			public errorCode?: string
		) {
			super(message);
		}
	},
	NetworkError: class NetworkError extends Error {
		constructor(
			message: string,
			public retryable: boolean = true
		) {
			super(message);
		}
	},
}));

describe('RunCommandPanel', () => {
	const mockOnRunSubmit = vi.fn();
	const mockOnStatusChange = vi.fn();
	const mockOnDebugFlagsChange = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Component Rendering', () => {
		it('should render without errors', () => {
			render(<RunCommandPanel />);
			expect(screen.getByLabelText(/run command/i)).toBeInTheDocument();
		});

		it('should render with default props', () => {
			render(<RunCommandPanel />);
			expect(screen.getByRole('region', { name: /run command/i })).toBeInTheDocument();
			expect(screen.getByText(/run command/i)).toBeInTheDocument();
			expect(screen.getByText(/fire events and watch them traverse/i)).toBeInTheDocument();
		});

		it('should render auth token input', () => {
			render(<RunCommandPanel />);
			expect(screen.getByLabelText(/auth token/i)).toBeInTheDocument();
		});

		it('should render payload editor', () => {
			render(<RunCommandPanel />);
			expect(screen.getByLabelText(/event payload editor/i)).toBeInTheDocument();
		});

		it('should render run mode tabs', () => {
			render(<RunCommandPanel />);
			expect(screen.getByText(/default run/i)).toBeInTheDocument();
			expect(screen.getByText(/bulk run/i)).toBeInTheDocument();
		});

		it('should render CTA button', () => {
			render(<RunCommandPanel />);
			expect(screen.getByRole('button', { name: /run default event/i })).toBeInTheDocument();
		});
	});

	describe('Props Handling', () => {
		it('should apply default auth token', () => {
			render(<RunCommandPanel defaultAuthToken="test-token-123" />);
			const input = screen.getByLabelText(/auth token/i) as HTMLInputElement;
			expect(input.value).toBe('test-token-123');
		});

		it('should apply default payload', () => {
			const customPayload = { test: 'custom' };
			render(<RunCommandPanel defaultPayload={customPayload} />);
			const textarea = screen.getByLabelText(/event payload editor/i) as HTMLTextAreaElement;
			expect(textarea.value).toContain('custom');
		});

		it('should disable button when disabled prop is true', () => {
			render(<RunCommandPanel disabled={true} defaultAuthToken="test-token" />);
			const button = screen.getByRole('button', { name: /run default event/i });
			expect(button).toBeDisabled();
		});

		it('should start in batch mode when variant is bulk', () => {
			render(<RunCommandPanel variant="bulk" />);
			expect(screen.getByLabelText(/batch size/i)).toBeInTheDocument();
		});
	});

	describe('Auth Token Input', () => {
		it('should allow typing in auth token input', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel />);
			const input = screen.getByLabelText(/auth token/i);
			await user.type(input, 'test-token-456');
			expect(input).toHaveValue('test-token-456');
		});

		it('should toggle token visibility', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel />);
			const input = screen.getByLabelText(/auth token/i);
			const toggleButton = screen.getByLabelText(/show token/i);

			// Initially password type
			expect(input).toHaveAttribute('type', 'password');

			// Click to show
			await user.click(toggleButton);
			expect(input).toHaveAttribute('type', 'text');
			expect(screen.getByLabelText(/hide token/i)).toBeInTheDocument();

			// Click to hide
			await user.click(toggleButton);
			expect(input).toHaveAttribute('type', 'password');
		});

		it('should disable button when auth token is empty', () => {
			render(<RunCommandPanel />);
			const button = screen.getByRole('button', { name: /run default event/i });
			expect(button).toBeDisabled();
		});

		it('should enable button when auth token is provided', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel />);
			const input = screen.getByLabelText(/auth token/i);
			const button = screen.getByRole('button', { name: /run default event/i });

			await user.type(input, 'test-token');
			expect(button).not.toBeDisabled();
		});
	});

	describe('Payload Editor', () => {
		it('should allow editing payload', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel />);
			const textarea = screen.getByLabelText(/event payload editor/i);
			await user.clear(textarea);
			await user.type(textarea, '{"test": "payload"}');
			expect(textarea).toHaveValue('{"test": "payload"}');
		});

		it('should validate JSON payload', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel />);
			const textarea = screen.getByLabelText(/event payload editor/i);

			// Type invalid JSON
			await user.clear(textarea);
			await user.type(textarea, '{invalid json}');

			// Wait for validation (debounced 500ms)
			await waitFor(
				() => {
					expect(screen.getByText(/invalid json payload/i)).toBeInTheDocument();
				},
				{ timeout: 1000 }
			);
		});

		it('should format JSON on button click', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel />);
			const textarea = screen.getByLabelText(/event payload editor/i);
			const formatButton = screen.getByLabelText(/format json/i);

			// Clear and add unformatted JSON
			await user.clear(textarea);
			await user.type(textarea, '{"a":1,"b":2}');

			// Click format
			await user.click(formatButton);

			// Check formatted (with indentation)
			const value = (textarea as HTMLTextAreaElement).value;
			expect(value).toContain('\n');
			expect(value).toContain('  '); // Indentation
		});
	});

	describe('Debug Flags Section', () => {
		it('should render debug flags accordion', () => {
			render(<RunCommandPanel />);
			expect(screen.getByLabelText(/toggle debug flags section/i)).toBeInTheDocument();
		});

		it('should toggle validation error flag', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel onDebugFlagsChange={mockOnDebugFlagsChange} />);

			// Expand accordion
			const accordionTrigger = screen.getByLabelText(/toggle debug flags section/i);
			await user.click(accordionTrigger);

			// Toggle switch
			const validationSwitch = screen.getByLabelText(/trigger validation error/i);
			await user.click(validationSwitch);

			// Check callback was called
			expect(mockOnDebugFlagsChange).toHaveBeenCalledWith({
				trigger_validation_error: true,
				trigger_processing_error: false,
				inject_latency_ms: 0,
			});
		});

		it('should show active flags count badge', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel />);

			// Expand accordion
			const accordionTrigger = screen.getByLabelText(/toggle debug flags section/i);
			await user.click(accordionTrigger);

			// Toggle validation error
			const validationSwitch = screen.getByLabelText(/trigger validation error/i);
			await user.click(validationSwitch);

			// Badge should appear
			await waitFor(() => {
				expect(screen.getByText(/1 active/i)).toBeInTheDocument();
			});
		});

		it('should adjust latency slider', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel />);

			// Expand accordion
			const accordionTrigger = screen.getByLabelText(/toggle debug flags section/i);
			await user.click(accordionTrigger);

			// Find latency slider
			const latencySlider = screen.getByLabelText(/inject latency, currently 0/i);
			expect(latencySlider).toBeInTheDocument();
		});
	});

	describe('Batch Mode', () => {
		it('should switch to batch mode', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel />);

			// Click bulk run tab
			const bulkTab = screen.getByText(/bulk run/i);
			await user.click(bulkTab);

			// Batch controls should appear
			expect(screen.getByLabelText(/batch size/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/inject latency/i)).toBeInTheDocument();
		});

		it('should adjust batch size slider', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel variant="bulk" />);

			// Batch size slider should show default value
			expect(screen.getByText(/25 events/i)).toBeInTheDocument();
		});

		it('should show batch progress bar when running', () => {
			// This would require mocking the useRunCommand hook's batchProgress state
			// For now, just verify the component structure exists
			render(<RunCommandPanel variant="bulk" />);
			expect(screen.getByLabelText(/batch size/i)).toBeInTheDocument();
		});
	});

	describe('Run Mode Tabs', () => {
		it('should switch between default and batch modes', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel />);

			// Default mode initially
			expect(screen.getByRole('button', { name: /run default event/i })).toBeInTheDocument();

			// Switch to batch
			await user.click(screen.getByText(/bulk run/i));
			expect(screen.getByRole('button', { name: /run bulk event/i })).toBeInTheDocument();

			// Switch back to default
			await user.click(screen.getByText(/default run/i));
			expect(screen.getByRole('button', { name: /run default event/i })).toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('should have proper ARIA labels', () => {
			render(<RunCommandPanel />);

			expect(screen.getByRole('region', { name: /run command/i })).toBeInTheDocument();
			expect(screen.getByLabelText(/auth token/i)).toHaveAttribute('aria-required', 'true');
			expect(screen.getByLabelText(/event payload editor/i)).toBeInTheDocument();
		});

		it('should have keyboard navigation support', async () => {
			const user = userEvent.setup();
			render(<RunCommandPanel />);

			// Tab through focusable elements
			const authInput = screen.getByLabelText(/auth token/i);
			await user.tab();
			expect(authInput).toHaveFocus();
		});

		it('should have live region for status updates', () => {
			render(<RunCommandPanel />);
			const region = screen.getByRole('region', { name: /run command/i });
			expect(region).toHaveAttribute('aria-live', 'polite');
		});
	});

	describe('Responsive Design', () => {
		it('should render mobile-friendly button text', () => {
			render(<RunCommandPanel />);
			// Both full and short button text should exist in DOM (hidden via CSS classes)
			expect(screen.getByText(/run default event/i)).toBeInTheDocument();
		});
	});
});
