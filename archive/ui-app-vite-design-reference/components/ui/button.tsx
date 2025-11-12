import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
	{
		variants: {
			variant: {
				default:
					'bg-primary text-neutral-100 shadow-card-base hover:shadow-card-active hover:scale-[1.02] active:scale-[0.98]',
				secondary:
					'border-2 border-primary/20 bg-surface-elevated text-neutral-100 hover:bg-surface-elevated/80 hover:border-primary/40',
				success:
					'bg-alert-success text-neutral-100 shadow-card-base hover:opacity-90',
				error:
					'bg-alert-error text-neutral-100 shadow-card-base hover:opacity-90',
				ghost: 'hover:bg-surface-elevated/50 text-neutral-100',
				outline:
					'border border-neutral-400/20 bg-transparent text-neutral-100 hover:bg-surface-elevated/50',
			},
			size: {
				default: 'h-12 px-lg py-md',
				sm: 'h-9 px-md py-sm text-sm',
				lg: 'h-14 px-xl py-lg text-lg',
				icon: 'h-10 w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, ...props }, ref) => {
		return (
			<button
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	}
);
Button.displayName = 'Button';

export { Button, buttonVariants };
