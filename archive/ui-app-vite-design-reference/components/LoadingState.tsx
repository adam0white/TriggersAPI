/**
 * Loading State Components
 * Story 7.6: UX Pattern Implementation
 *
 * Skeleton loaders for various panel types.
 * Features:
 * - Shimmer animation (pulse)
 * - Respects prefers-reduced-motion
 * - Consistent with design tokens
 */

import React from 'react';

/**
 * Generic skeleton box
 */
export function Skeleton({
	className = '',
	width = '100%',
	height = '1rem',
}: {
	className?: string;
	width?: string;
	height?: string;
}) {
	return (
		<div
			className={`bg-[rgba(255,253,249,0.1)] rounded animate-pulse-opacity ${className}`}
			style={{ width, height }}
			aria-hidden="true"
		/>
	);
}

/**
 * Loading skeleton for logs panel
 */
export function LogsLoadingSkeleton() {
	return (
		<div className="space-y-3 p-4">
			{[...Array(5)].map((_, i) => (
				<div key={i} className="space-y-2">
					<div className="flex items-center gap-2">
						<Skeleton width="80px" height="20px" />
						<Skeleton width="120px" height="20px" />
					</div>
					<Skeleton width="100%" height="16px" />
					<Skeleton width="60%" height="16px" />
				</div>
			))}
		</div>
	);
}

/**
 * Loading skeleton for inbox panel (table)
 */
export function InboxLoadingSkeleton() {
	return (
		<div className="space-y-2 p-4">
			{/* Table header */}
			<div className="flex gap-4 pb-2 border-b border-[rgba(255,253,249,0.1)]">
				<Skeleton width="100px" height="16px" />
				<Skeleton width="150px" height="16px" />
				<Skeleton width="80px" height="16px" />
			</div>

			{/* Table rows */}
			{[...Array(8)].map((_, i) => (
				<div key={i} className="flex gap-4 py-2">
					<Skeleton width="100px" height="16px" />
					<Skeleton width="150px" height="16px" />
					<Skeleton width="80px" height="16px" />
				</div>
			))}
		</div>
	);
}

/**
 * Loading skeleton for metrics tiles
 */
export function MetricsLoadingSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-4 p-4">
			{[...Array(4)].map((_, i) => (
				<div key={i} className="card-base p-4 space-y-2">
					<Skeleton width="80px" height="14px" />
					<Skeleton width="100px" height="28px" />
				</div>
			))}
		</div>
	);
}

/**
 * Loading skeleton for history list
 */
export function HistoryLoadingSkeleton() {
	return (
		<div className="space-y-2 p-4">
			{[...Array(6)].map((_, i) => (
				<div key={i} className="card-base p-3 space-y-2">
					<div className="flex justify-between">
						<Skeleton width="120px" height="16px" />
						<Skeleton width="60px" height="16px" />
					</div>
					<Skeleton width="100%" height="14px" />
				</div>
			))}
		</div>
	);
}

/**
 * Generic loading spinner
 */
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
	const sizeClasses = {
		sm: 'w-4 h-4',
		md: 'w-8 h-8',
		lg: 'w-12 h-12',
	};

	return (
		<div
			className={`${sizeClasses[size]} border-2 border-[rgba(255,253,249,0.2)] border-t-[#FF4F00] rounded-full animate-spin`}
			role="status"
			aria-label="Loading"
		/>
	);
}

/**
 * Loading state with message
 */
export function LoadingState({ message = 'Loading...' }: { message?: string }) {
	return (
		<div className="flex flex-col items-center justify-center py-12 gap-4">
			<LoadingSpinner size="lg" />
			<p className="text-sm text-[#FFF3E6]">{message}</p>
		</div>
	);
}
