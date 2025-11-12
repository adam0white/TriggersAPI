/**
 * Select component - Dropdown selection
 * Built with Radix UI primitives
 * Story 7.4: Used for log level and status filtering
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => {
	return (
		<select
			ref={ref}
			className={cn(
				'flex h-10 w-full rounded border border-neutral-400/20 bg-surface px-3 py-2 text-sm text-neutral-100',
				'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
				'disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
		/>
	);
});
Select.displayName = 'Select';

export { Select };
