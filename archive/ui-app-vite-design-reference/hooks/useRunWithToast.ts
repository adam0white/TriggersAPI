/**
 * useRunWithToast Hook
 * Story 7.6: UX Pattern Implementation
 *
 * Wrapper around run command that automatically shows toast notifications
 * for success, error, and progress states.
 */

import { useCallback } from 'react';
import { useToastHelpers } from '@/context/ToastContext';

export function useRunWithToast() {
	const toast = useToastHelpers();

	const runWithToast = useCallback(
		async (
			runFn: () => Promise<any>,
			options?: {
				successMessage?: string;
				errorMessage?: string;
				loadingMessage?: string;
			},
		) => {
			const {
				successMessage = 'Event submitted successfully',
				errorMessage = 'Failed to submit event',
				loadingMessage,
			} = options || {};

			// Optional: Show loading toast
			if (loadingMessage) {
				toast.info(loadingMessage);
			}

			try {
				const result = await runFn();
				toast.success(successMessage);
				return result;
			} catch (error) {
				const message =
					error instanceof Error ? `${errorMessage}: ${error.message}` : errorMessage;
				toast.error(message, {
					label: 'Retry',
					onClick: () => runWithToast(runFn, options),
				});
				throw error;
			}
		},
		[toast],
	);

	return { runWithToast, toast };
}
