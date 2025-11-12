/**
 * UX Patterns - Centralized exports
 * Story 7.6: UX Pattern Implementation
 *
 * All pattern components for easy import throughout the app
 */

// Toast system
export { ToastProvider, useToast, useToastHelpers } from '@/context/ToastContext';
export { ToastStack } from '../ToastStack';

// Confirmation dialogs
export { ConfirmDialog, useConfirm, type ConfirmDialogProps } from '../ConfirmDialog';

// Command palette
export { CommandPalette, CommandPaletteTrigger, type CommandItem } from '../CommandPalette';

// Empty states
export {
	EmptyState,
	LogsEmptyState,
	InboxEmptyState,
	MetricsEmptyState,
	HistoryEmptyState,
	DLQEmptyState,
	WelcomeEmptyState,
	type EmptyStateProps,
} from '../EmptyState';

// Loading states
export {
	Skeleton,
	LogsLoadingSkeleton,
	InboxLoadingSkeleton,
	MetricsLoadingSkeleton,
	HistoryLoadingSkeleton,
	LoadingSpinner,
	LoadingState,
} from '../LoadingState';

// Error states
export {
	ErrorState,
	ErrorBanner,
	StaleDataBanner,
	type ErrorStateProps,
} from '../ErrorState';
