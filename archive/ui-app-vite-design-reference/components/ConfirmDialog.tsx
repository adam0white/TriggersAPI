/**
 * Confirmation Dialog Component
 * Story 7.6: UX Pattern Implementation
 *
 * Reusable confirmation dialog for destructive actions.
 * Uses Radix AlertDialog for accessibility.
 *
 * Features:
 * - Default and destructive variants
 * - Optional type-to-confirm guard
 * - Focus management
 * - Keyboard navigation (Esc to cancel, Enter to confirm)
 */

import React, { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

export interface ConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: 'default' | 'destructive';
	onConfirm: () => void | Promise<void>;
	onCancel?: () => void;
	requireConfirmText?: string; // e.g., "DELETE" - user must type this to confirm
}

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	message,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	variant = 'default',
	onConfirm,
	onCancel,
	requireConfirmText,
}: ConfirmDialogProps) {
	const [confirmText, setConfirmText] = useState('');
	const [isConfirming, setIsConfirming] = useState(false);

	const isConfirmEnabled = requireConfirmText
		? confirmText.trim().toUpperCase() === requireConfirmText.toUpperCase()
		: true;

	const handleConfirm = async () => {
		if (!isConfirmEnabled || isConfirming) return;

		setIsConfirming(true);
		try {
			await onConfirm();
			onOpenChange(false);
			setConfirmText('');
		} catch (error) {
			console.error('Confirmation action failed:', error);
		} finally {
			setIsConfirming(false);
		}
	};

	const handleCancel = () => {
		onCancel?.();
		onOpenChange(false);
		setConfirmText('');
	};

	const confirmButtonClasses =
		variant === 'destructive'
			? 'bg-[#FF4F00] text-white hover:bg-[#E64600] focus-visible:ring-[#FF4F00]'
			: 'bg-[#2B2358] text-white hover:bg-[#3D3170] focus-visible:ring-[#C1B7FF]';

	return (
		<AlertDialog.Root open={open} onOpenChange={onOpenChange}>
			<AlertDialog.Portal>
				<AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-fade-in" />
				<AlertDialog.Content
					className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
						bg-[#2B2358] border border-[rgba(255,253,249,0.1)] rounded-lg shadow-[var(--shadow-modal)]
						w-full max-w-md p-6 animate-slide-in
						focus:outline-none"
				>
					{/* Header */}
					<AlertDialog.Title className="text-xl font-medium text-[#FFFDF9] mb-2">
						{title}
					</AlertDialog.Title>

					{/* Message */}
					<AlertDialog.Description className="text-sm text-[#FFF3E6] leading-relaxed mb-4">
						{message}
					</AlertDialog.Description>

					{/* Type-to-confirm input */}
					{requireConfirmText && (
						<div className="mb-4">
							<label htmlFor="confirm-input" className="block text-sm text-[#FFF3E6] mb-2">
								Type <strong className="text-[#FFFDF9]">{requireConfirmText}</strong> to confirm:
							</label>
							<input
								id="confirm-input"
								type="text"
								value={confirmText}
								onChange={(e) => setConfirmText(e.target.value)}
								className="w-full px-3 py-2 bg-[#201515] border border-[rgba(255,253,249,0.1)]
									text-[#FFFDF9] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]"
								placeholder={requireConfirmText}
								autoComplete="off"
							/>
						</div>
					)}

					{/* Actions */}
					<div className="flex gap-3 justify-end">
						<AlertDialog.Cancel asChild>
							<button
								onClick={handleCancel}
								className="px-4 py-2 text-sm font-medium text-[#FFFDF9]
									bg-transparent border border-[rgba(255,253,249,0.2)]
									rounded hover:bg-[rgba(255,253,249,0.05)]
									focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C1B7FF]
									transition-colors"
							>
								{cancelLabel}
							</button>
						</AlertDialog.Cancel>

						<AlertDialog.Action asChild>
							<button
								onClick={handleConfirm}
								disabled={!isConfirmEnabled || isConfirming}
								className={`px-4 py-2 text-sm font-medium rounded
									focus:outline-none focus-visible:ring-2
									disabled:opacity-50 disabled:cursor-not-allowed
									transition-colors
									${confirmButtonClasses}`}
							>
								{isConfirming ? 'Processing...' : confirmLabel}
							</button>
						</AlertDialog.Action>
					</div>

					{/* Close button */}
					<AlertDialog.Cancel asChild>
						<button
							onClick={handleCancel}
							className="absolute top-4 right-4 text-[#FFF3E6] hover:text-[#FFFDF9]
								focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C1B7FF] rounded"
							aria-label="Close"
						>
							✕
						</button>
					</AlertDialog.Cancel>
				</AlertDialog.Content>
			</AlertDialog.Portal>
		</AlertDialog.Root>
	);
}

/**
 * Hook for managing confirmation dialogs
 * Returns [isOpen, confirm function, ConfirmDialog component]
 */
export function useConfirm() {
	const [isOpen, setIsOpen] = useState(false);
	const [config, setConfig] = useState<Omit<ConfirmDialogProps, 'open' | 'onOpenChange'> | null>(null);

	const confirm = (dialogConfig: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'>) => {
		return new Promise<boolean>((resolve) => {
			setConfig({
				...dialogConfig,
				onConfirm: async () => {
					await dialogConfig.onConfirm();
					resolve(true);
				},
				onCancel: () => {
					dialogConfig.onCancel?.();
					resolve(false);
				},
			});
			setIsOpen(true);
		});
	};

	const Dialog = config ? (
		<ConfirmDialog {...config} open={isOpen} onOpenChange={setIsOpen} />
	) : null;

	return { confirm, Dialog };
}
