/**
 * ConfirmDialog Component Tests
 * Story 7.6: UX Pattern Implementation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';
import React, { useState } from 'react';

function TestWrapper() {
	const [open, setOpen] = useState(false);
	const handleConfirm = vi.fn();

	return (
		<div>
			<button onClick={() => setOpen(true)}>Open Dialog</button>
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				title="Test Dialog"
				message="Are you sure?"
				onConfirm={handleConfirm}
			/>
		</div>
	);
}

describe('ConfirmDialog', () => {
	it('renders dialog when open', async () => {
		const user = userEvent.setup();
		render(<TestWrapper />);

		await user.click(screen.getByText('Open Dialog'));

		expect(screen.getByText('Test Dialog')).toBeInTheDocument();
		expect(screen.getByText('Are you sure?')).toBeInTheDocument();
	});

	it('shows confirm and cancel buttons', async () => {
		const user = userEvent.setup();
		render(<TestWrapper />);

		await user.click(screen.getByText('Open Dialog'));

		expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
	});

	it('calls onConfirm when confirm button clicked', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();

		render(
			<ConfirmDialog
				open={true}
				onOpenChange={() => {}}
				title="Test"
				message="Message"
				onConfirm={onConfirm}
			/>,
		);

		await user.click(screen.getByRole('button', { name: /confirm/i }));

		expect(onConfirm).toHaveBeenCalled();
	});

	it('closes on cancel button click', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();

		render(
			<ConfirmDialog
				open={true}
				onOpenChange={onOpenChange}
				title="Test"
				message="Message"
				onConfirm={() => {}}
			/>,
		);

		await user.click(screen.getByRole('button', { name: /cancel/i }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('shows destructive styling for destructive variant', () => {
		render(
			<ConfirmDialog
				open={true}
				onOpenChange={() => {}}
				title="Delete?"
				message="Cannot be undone"
				variant="destructive"
				onConfirm={() => {}}
			/>,
		);

		const confirmButton = screen.getByRole('button', { name: /confirm/i });
		expect(confirmButton).toHaveClass('bg-[#FF4F00]');
	});

	it('requires confirmation text when requireConfirmText is set', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();

		render(
			<ConfirmDialog
				open={true}
				onOpenChange={() => {}}
				title="Delete?"
				message="Type DELETE to confirm"
				requireConfirmText="DELETE"
				variant="destructive"
				onConfirm={onConfirm}
			/>,
		);

		// Confirm button should be disabled initially
		const confirmButton = screen.getByRole('button', { name: /confirm/i });
		expect(confirmButton).toBeDisabled();

		// Type the confirmation text
		const input = screen.getByPlaceholderText('DELETE');
		await user.type(input, 'DELETE');

		// Button should now be enabled
		expect(confirmButton).not.toBeDisabled();

		// Click confirm
		await user.click(confirmButton);

		expect(onConfirm).toHaveBeenCalled();
	});

	it('closes on Escape key', async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();

		render(
			<ConfirmDialog
				open={true}
				onOpenChange={onOpenChange}
				title="Test"
				message="Message"
				onConfirm={() => {}}
			/>,
		);

		await user.keyboard('{Escape}');

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
