/**
 * Badge component - Status indicators and labels
 * Built with class-variance-authority for variant management
 * Story 7.4: Used in logs level badges and inbox status badges
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
	'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
	{
		variants: {
			variant: {
				default: 'border-transparent bg-primary text-white hover:bg-primary/80',
				secondary: 'border-transparent bg-surface-elevated text-neutral-100 hover:bg-surface-elevated/80',
				success: 'border-transparent bg-alert-success text-neutral-100',
				warning: 'border-transparent bg-alert-warning text-neutral-900',
				error: 'border-transparent bg-alert-error text-white',
				info: 'border-transparent bg-accent-1 text-neutral-900',
				outline: 'text-neutral-100 border-neutral-400/20',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	}
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
