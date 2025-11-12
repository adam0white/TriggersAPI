/**
 * Toast Stack Component
 * Story 7.6: UX Pattern Implementation
 *
 * Renders toast notifications in a stack at top-right of viewport.
 * Features:
 * - Fixed positioning (top-right)
 * - Max 3 visible toasts (queue others)
 * - Slide-in/fade-out animations
 * - Pause on hover
 * - Accessible (role="alert" for errors/warnings, role="status" for success/info)
 */

import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import type { Toast } from '../types/toast';

interface ToastItemProps {
	toast: Toast;
	onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
	const [isExiting, setIsExiting] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const startTimeRef = useRef<number>(0);
	const remainingTimeRef = useRef<number>(toast.duration || 0);

	const startTimer = () => {
		if (toast.duration && toast.duration > 0) {
			startTimeRef.current = Date.now();
			timerRef.current = setTimeout(() => {
				handleDismiss();
			}, remainingTimeRef.current);
		}
	};

	const pauseTimer = () => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			const elapsed = Date.now() - startTimeRef.current;
			remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
		}
	};

	const handleDismiss = () => {
		setIsExiting(true);
		setTimeout(() => {
			onDismiss();
		}, 150); // Match fade-out duration
	};

	useEffect(() => {
		if (!isPaused) {
			startTimer();
		}

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
			}
		};
	}, [isPaused, toast.duration]);

	const handleMouseEnter = () => {
		setIsPaused(true);
		pauseTimer();
	};

	const handleMouseLeave = () => {
		setIsPaused(false);
	};

	// Determine styling based on toast type
	const getToastStyles = () => {
		switch (toast.type) {
			case 'success':
				return {
					bg: 'bg-[#1F3121]',
					text: 'text-[#FFFDF9]',
					border: 'border-[#1F3121]',
					icon: '✓',
				};
			case 'error':
				return {
					bg: 'bg-[#FF4F00]',
					text: 'text-[#FFFDF9]',
					border: 'border-[#FF4F00]',
					icon: '✕',
				};
			case 'warning':
				return {
					bg: 'bg-[#FFBF6E]',
					text: 'text-[#201515]',
					border: 'border-[#FFBF6E]',
					icon: '⚠',
				};
			case 'info':
				return {
					bg: 'bg-[#2B2358]',
					text: 'text-[#FFF3E6]',
					border: 'border-[#2B2358]',
					icon: 'ℹ',
				};
		}
	};

	const styles = getToastStyles();
	const role = toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status';
	const ariaLive = toast.type === 'error' || toast.type === 'warning' ? 'assertive' : 'polite';

	return (
		<div
			role={role}
			aria-live={ariaLive}
			className={`
				${styles.bg} ${styles.text} ${styles.border}
				border rounded-lg shadow-[var(--shadow-card-base)]
				p-4 max-w-[320px] w-full
				flex items-start gap-3
				${isExiting ? 'opacity-0 transition-opacity duration-150' : 'animate-slide-in-right'}
			`}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{/* Icon */}
			<div className="text-lg flex-shrink-0 mt-0.5" aria-hidden="true">
				{styles.icon}
			</div>

			{/* Content */}
			<div className="flex-1 min-w-0">
				<p className="text-sm leading-relaxed break-words">{toast.message}</p>

				{/* Action button */}
				{toast.action && (
					<button
						onClick={(e) => {
							e.stopPropagation();
							toast.action?.onClick();
							handleDismiss();
						}}
						className="mt-2 text-sm underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-current rounded"
					>
						{toast.action.label}
					</button>
				)}
			</div>

			{/* Dismiss button */}
			{toast.dismissible && (
				<button
					onClick={handleDismiss}
					className="flex-shrink-0 text-lg hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-current rounded"
					aria-label="Dismiss notification"
				>
					✕
				</button>
			)}
		</div>
	);
}

export function ToastStack() {
	const { toasts, removeToast } = useToast();

	// Show max 3 toasts at once
	const visibleToasts = toasts.slice(0, 3);

	if (visibleToasts.length === 0) {
		return null;
	}

	return (
		<div
			className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none"
			style={{ maxWidth: 'calc(100vw - 2rem)' }}
		>
			{visibleToasts.map((toast) => (
				<div key={toast.id} className="pointer-events-auto">
					<ToastItem toast={toast} onDismiss={() => removeToast(toast.id)} />
				</div>
			))}
		</div>
	);
}
