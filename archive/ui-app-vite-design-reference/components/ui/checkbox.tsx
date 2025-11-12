/**
 * Checkbox component - Selection indicator
 * Built with semantic HTML and custom styling
 * Story 7.4: Used for bulk operations in Inbox panel
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
	indeterminate?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
	({ className, indeterminate, ...props }, ref) => {
		const internalRef = React.useRef<HTMLInputElement>(null);
		const combinedRef = (ref || internalRef) as React.RefObject<HTMLInputElement>;

		React.useEffect(() => {
			if (combinedRef.current) {
				combinedRef.current.indeterminate = indeterminate || false;
			}
		}, [indeterminate, combinedRef]);

		return (
			<input
				type="checkbox"
				ref={combinedRef}
				className={cn(
					'h-4 w-4 rounded border border-neutral-400/20 bg-surface text-primary',
					'focus:ring-2 focus:ring-primary focus:ring-offset-2',
					'disabled:cursor-not-allowed disabled:opacity-50',
					className
				)}
				{...props}
			/>
		);
	}
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
