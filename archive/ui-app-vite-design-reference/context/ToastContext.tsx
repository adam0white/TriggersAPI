/**
 * Toast Context & Provider
 * Story 7.6: UX Pattern Implementation
 *
 * Provides global toast notification system with:
 * - Success, error, warning, info variants
 * - Auto-dismiss with configurable duration
 * - Manual dismiss
 * - Action buttons
 * - Duplicate consolidation
 * - Queue management (max 10)
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import type { Toast, ToastContextValue } from '../types/toast';

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
		const id = `toast-${++toastIdCounter}`;

		// Check for duplicate messages
		const existingToast = toasts.find((t) => t.message === toast.message && t.type === toast.type);

		if (existingToast) {
			// Don't add duplicate, just return existing ID
			return existingToast.id;
		}

		const newToast: Toast = {
			...toast,
			id,
			dismissible: toast.dismissible ?? true,
		};

		setToasts((current) => {
			// Limit to max 10 toasts (remove oldest if needed)
			const updated = [newToast, ...current];
			return updated.length > 10 ? updated.slice(0, 10) : updated;
		});

		return id;
	}, [toasts]);

	const removeToast = useCallback((id: string) => {
		setToasts((current) => current.filter((toast) => toast.id !== id));
	}, []);

	const clearAll = useCallback(() => {
		setToasts([]);
	}, []);

	const value: ToastContextValue = {
		toasts,
		addToast,
		removeToast,
		clearAll,
	};

	return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error('useToast must be used within ToastProvider');
	}
	return context;
}

/**
 * Convenience helper hook for common toast patterns
 */
export function useToastHelpers() {
	const { addToast } = useToast();

	return {
		success: (message: string, action?: Toast['action']) =>
			addToast({ type: 'success', message, duration: 4000, action }),
		error: (message: string, action?: Toast['action']) =>
			addToast({ type: 'error', message, duration: undefined, action }), // Never auto-dismiss
		warning: (message: string, action?: Toast['action']) =>
			addToast({ type: 'warning', message, duration: 6000, action }),
		info: (message: string, action?: Toast['action']) =>
			addToast({ type: 'info', message, duration: 5000, action }),
	};
}
