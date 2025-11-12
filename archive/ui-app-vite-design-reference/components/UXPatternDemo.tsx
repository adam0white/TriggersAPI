/**
 * UX Pattern Demo Component
 * Story 7.6: UX Pattern Implementation
 *
 * Demonstrates all UX patterns (toasts, dialogs, empty states, etc.)
 * This component can be used for testing and demonstration purposes.
 */

import React, { useState } from 'react';
import { useToastHelpers } from '@/context/ToastContext';
import { useConfirm } from './ConfirmDialog';
import {
	EmptyState,
	LogsEmptyState,
	InboxEmptyState,
	MetricsEmptyState,
	HistoryEmptyState,
} from './EmptyState';
import { LoadingSpinner, LoadingState, Skeleton } from './LoadingState';
import { ErrorState, ErrorBanner, StaleDataBanner } from './ErrorState';
import { Button } from './ui/button';

export function UXPatternDemo() {
	const toast = useToastHelpers();
	const { confirm, Dialog } = useConfirm();
	const [showError, setShowError] = useState(false);
	const [emptyStateType, setEmptyStateType] = useState<'logs' | 'inbox' | 'metrics' | 'history'>(
		'logs',
	);

	const handleShowToasts = () => {
		toast.success('This is a success toast!');
		setTimeout(() => toast.error('This is an error toast (stays until dismissed)'), 500);
		setTimeout(() => toast.warning('This is a warning toast'), 1000);
		setTimeout(() => toast.info('This is an info toast'), 1500);
	};

	const handleShowToastWithAction = () => {
		toast.error('Network connection failed', {
			label: 'Retry',
			onClick: () => toast.info('Retrying connection...'),
		});
	};

	const handleShowConfirmDialog = async () => {
		const confirmed = await confirm({
			title: 'Clear all logs?',
			message:
				'This action cannot be undone. All logs for this run will be permanently deleted.',
			confirmLabel: 'Clear All',
			cancelLabel: 'Cancel',
			variant: 'destructive',
			onConfirm: () => {
				toast.success('Logs cleared successfully');
			},
		});
	};

	const handleShowTypeToConfirm = async () => {
		await confirm({
			title: 'Delete this run?',
			message: 'This will remove all logs and events. Cannot be undone.',
			confirmLabel: 'Delete',
			variant: 'destructive',
			requireConfirmText: 'DELETE',
			onConfirm: () => {
				toast.success('Run deleted');
			},
		});
	};

	const renderEmptyState = () => {
		switch (emptyStateType) {
			case 'logs':
				return <LogsEmptyState onRunEvent={() => toast.info('Running default event...')} />;
			case 'inbox':
				return <InboxEmptyState onRunEvent={() => toast.info('Running default event...')} />;
			case 'metrics':
				return <MetricsEmptyState />;
			case 'history':
				return <HistoryEmptyState onRunEvent={() => toast.info('Running default event...')} />;
		}
	};

	return (
		<div className="p-8 space-y-8 bg-[#201515] min-h-screen">
			<h1 className="text-3xl font-bold text-[#FFFDF9]">UX Pattern Demo - Story 7.6</h1>

			{/* Toast Demos */}
			<section className="card-base p-6 space-y-4">
				<h2 className="text-xl font-medium text-[#FFFDF9]">Toast Notifications</h2>
				<div className="flex flex-wrap gap-3">
					<Button onClick={handleShowToasts}>Show All Toast Types</Button>
					<Button onClick={handleShowToastWithAction} variant="secondary">
						Show Toast with Action
					</Button>
					<Button onClick={() => toast.success('Simple success message')}>Success Toast</Button>
					<Button onClick={() => toast.error('Something went wrong')}>Error Toast</Button>
					<Button onClick={() => toast.warning('Warning message')}>Warning Toast</Button>
					<Button onClick={() => toast.info('Info message')}>Info Toast</Button>
				</div>
			</section>

			{/* Confirmation Dialog Demos */}
			<section className="card-base p-6 space-y-4">
				<h2 className="text-xl font-medium text-[#FFFDF9]">Confirmation Dialogs</h2>
				<div className="flex flex-wrap gap-3">
					<Button onClick={handleShowConfirmDialog}>Show Destructive Confirm</Button>
					<Button onClick={handleShowTypeToConfirm} variant="secondary">
						Show Type-to-Confirm
					</Button>
				</div>
				{Dialog}
			</section>

			{/* Empty States */}
			<section className="card-base p-6 space-y-4">
				<h2 className="text-xl font-medium text-[#FFFDF9]">Empty States</h2>
				<div className="flex flex-wrap gap-3 mb-4">
					<Button onClick={() => setEmptyStateType('logs')} variant={emptyStateType === 'logs' ? 'default' : 'secondary'}>
						Logs Empty
					</Button>
					<Button onClick={() => setEmptyStateType('inbox')} variant={emptyStateType === 'inbox' ? 'default' : 'secondary'}>
						Inbox Empty
					</Button>
					<Button onClick={() => setEmptyStateType('metrics')} variant={emptyStateType === 'metrics' ? 'default' : 'secondary'}>
						Metrics Empty
					</Button>
					<Button onClick={() => setEmptyStateType('history')} variant={emptyStateType === 'history' ? 'default' : 'secondary'}>
						History Empty
					</Button>
				</div>
				<div className="border border-[rgba(255,253,249,0.1)] rounded-lg min-h-[300px]">
					{renderEmptyState()}
				</div>
			</section>

			{/* Loading States */}
			<section className="card-base p-6 space-y-4">
				<h2 className="text-xl font-medium text-[#FFFDF9]">Loading States</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="border border-[rgba(255,253,249,0.1)] rounded-lg p-4">
						<h3 className="text-sm text-[#FFF3E6] mb-3">Spinner</h3>
						<LoadingSpinner size="lg" />
					</div>
					<div className="border border-[rgba(255,253,249,0.1)] rounded-lg p-4">
						<h3 className="text-sm text-[#FFF3E6] mb-3">Loading State</h3>
						<LoadingState message="Loading data..." />
					</div>
					<div className="border border-[rgba(255,253,249,0.1)] rounded-lg p-4 space-y-2">
						<h3 className="text-sm text-[#FFF3E6] mb-3">Skeleton</h3>
						<Skeleton height="20px" />
						<Skeleton height="20px" width="80%" />
						<Skeleton height="20px" width="60%" />
					</div>
				</div>
			</section>

			{/* Error States */}
			<section className="card-base p-6 space-y-4">
				<h2 className="text-xl font-medium text-[#FFFDF9]">Error States</h2>
				<Button onClick={() => setShowError(!showError)}>
					{showError ? 'Hide' : 'Show'} Error State
				</Button>
				{showError && (
					<>
						<ErrorBanner
							message="Failed to load data"
							onRetry={() => toast.info('Retrying...')}
							onDismiss={() => setShowError(false)}
						/>
						<ErrorState
							title="Connection Error"
							message="Unable to connect to the server. Please check your internet connection."
							onRetry={() => {
								toast.info('Retrying...');
								setShowError(false);
							}}
						/>
						<StaleDataBanner
							lastUpdated={new Date(Date.now() - 3 * 60000)}
							onRefresh={() => toast.info('Refreshing data...')}
						/>
					</>
				)}
			</section>

			{/* Keyboard Shortcuts */}
			<section className="card-base p-6 space-y-4">
				<h2 className="text-xl font-medium text-[#FFFDF9]">Keyboard Shortcuts</h2>
				<p className="text-sm text-[#FFF3E6]">
					Press{' '}
					<kbd className="px-2 py-1 bg-[rgba(255,253,249,0.1)] rounded border border-[rgba(255,253,249,0.1)]">
						⌘K
					</kbd>{' '}
					(or{' '}
					<kbd className="px-2 py-1 bg-[rgba(255,253,249,0.1)] rounded border border-[rgba(255,253,249,0.1)]">
						Ctrl+K
					</kbd>
					) to open the Command Palette
				</p>
			</section>
		</div>
	);
}
