/**
 * Error State Component
 * Story 7.6: UX Pattern Implementation
 *
 * Error states with retry functionality for network/API failures.
 * Features:
 * - Error message display
 * - Manual retry button
 * - Auto-retry for transient errors (optional)
 * - Accessible error announcements
 */

import React, { useEffect, useState } from 'react';

export interface ErrorStateProps {
	title?: string;
	message: string;
	onRetry?: () => void;
	autoRetry?: boolean;
	autoRetryDelay?: number; // in seconds
}

export function ErrorState({
	title = 'Something went wrong',
	message,
	onRetry,
	autoRetry = false,
	autoRetryDelay = 3,
}: ErrorStateProps) {
	const [retryCountdown, setRetryCountdown] = useState<number | null>(
		autoRetry ? autoRetryDelay : null,
	);

	useEffect(() => {
		if (!autoRetry || !onRetry || retryCountdown === null) return;

		if (retryCountdown === 0) {
			onRetry();
			return;
		}

		const timer = setTimeout(() => {
			setRetryCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
		}, 1000);

		return () => clearTimeout(timer);
	}, [autoRetry, onRetry, retryCountdown]);

	return (
		<div
			className="flex flex-col items-center justify-center py-12 px-4 text-center"
			role="alert"
			aria-live="assertive"
		>
			{/* Error icon */}
			<div className="text-5xl mb-4" aria-hidden="true">
				⚠️
			</div>

			{/* Title */}
			<h3 className="text-lg font-medium text-[#FFFDF9] mb-2">{title}</h3>

			{/* Error message */}
			<p className="text-sm text-[#FFF3E6] max-w-md leading-relaxed mb-4">{message}</p>

			{/* Retry button */}
			{onRetry && (
				<button
					onClick={() => {
						setRetryCountdown(null); // Cancel auto-retry
						onRetry();
					}}
					className="px-4 py-2 bg-[#FF4F00] text-white text-sm font-medium rounded
						hover:bg-[#E64600] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]
						transition-colors"
				>
					{retryCountdown !== null && retryCountdown > 0
						? `Retrying in ${retryCountdown}s...`
						: 'Retry'}
				</button>
			)}
		</div>
	);
}

/**
 * Inline error banner for panels
 */
export function ErrorBanner({
	message,
	onRetry,
	onDismiss,
}: {
	message: string;
	onRetry?: () => void;
	onDismiss?: () => void;
}) {
	return (
		<div
			className="flex items-center justify-between gap-4 p-3 mb-4
				bg-[#FFBF6E]/10 border border-[#FFBF6E] rounded text-sm"
			role="alert"
		>
			<div className="flex items-center gap-2 flex-1">
				<span className="text-lg" aria-hidden="true">
					⚠️
				</span>
				<p className="text-[#FFFDF9]">{message}</p>
			</div>

			<div className="flex items-center gap-2">
				{onRetry && (
					<button
						onClick={onRetry}
						className="px-3 py-1 bg-[#FF4F00] text-white text-xs font-medium rounded
							hover:bg-[#E64600] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]
							transition-colors"
					>
						Retry
					</button>
				)}
				{onDismiss && (
					<button
						onClick={onDismiss}
						className="text-[#FFF3E6] hover:text-[#FFFDF9]
							focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] rounded"
						aria-label="Dismiss"
					>
						✕
					</button>
				)}
			</div>
		</div>
	);
}

/**
 * Stale data indicator banner
 */
export function StaleDataBanner({ lastUpdated, onRefresh }: { lastUpdated: Date; onRefresh: () => void }) {
	const [minutesAgo, setMinutesAgo] = useState(0);

	useEffect(() => {
		const updateMinutes = () => {
			const diff = Date.now() - lastUpdated.getTime();
			setMinutesAgo(Math.floor(diff / 60000));
		};

		updateMinutes();
		const interval = setInterval(updateMinutes, 10000); // Update every 10s

		return () => clearInterval(interval);
	}, [lastUpdated]);

	if (minutesAgo === 0) return null;

	return (
		<div
			className="flex items-center justify-between gap-4 p-2 mb-3
				bg-[rgba(255,253,249,0.05)] border border-[rgba(255,253,249,0.1)] rounded text-xs"
		>
			<p className="text-[#FFF3E6]">Data last updated {minutesAgo} minute{minutesAgo !== 1 ? 's' : ''} ago</p>
			<button
				onClick={onRefresh}
				className="px-2 py-1 text-[#C1B7FF] hover:text-[#FFFDF9]
					focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C1B7FF] rounded
					transition-colors"
			>
				Refresh
			</button>
		</div>
	);
}
