/**
 * Toast/Notification Types
 * Story 7.6: UX Pattern Implementation
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
	label: string;
	onClick: () => void;
}

export interface Toast {
	id: string;
	type: ToastType;
	message: string;
	duration?: number; // in milliseconds, undefined = never auto-dismiss
	action?: ToastAction;
	dismissible?: boolean;
}

export interface ToastContextValue {
	toasts: Toast[];
	addToast: (toast: Omit<Toast, 'id'>) => string;
	removeToast: (id: string) => void;
	clearAll: () => void;
}
