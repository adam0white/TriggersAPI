import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Dashboard Layout Component
 * Story 7.1: Two-column Mission-Control Pulse layout
 *
 * Responsive behavior:
 * - Desktop (≥1440px): Two columns side-by-side
 * - Large Laptop (≥1200px): Two columns maintained, slight compression
 * - Tablet (768-1199px): Columns stack vertically
 * - Mobile (<768px): Single column with accordion panels
 *
 * @example
 * ```tsx
 * <DashboardLayout>
 *   <Column1>...</Column1>
 *   <Column2>...</Column2>
 * </DashboardLayout>
 * ```
 */

interface DashboardLayoutProps {
	children: React.ReactNode;
	className?: string;
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
	return (
		<div
			className={cn(
				// Base styles
				'min-h-screen w-full bg-surface',
				// Container with max-width
				'mx-auto max-w-container',
				// Responsive grid layout
				'grid grid-cols-1',
				'md:grid-cols-1', // Tablet: stacked
				'xl:grid-cols-[minmax(340px,1fr),2fr]', // Desktop: two columns with flex
				// Spacing
				'gap-xl p-xl',
				// Accessibility
				'scrollbar-dark',
				className
			)}
			role="main"
			aria-label="Mission Control Pulse Dashboard"
		>
			{children}
		</div>
	);
}
