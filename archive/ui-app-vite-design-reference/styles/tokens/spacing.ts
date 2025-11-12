/**
 * Design Tokens - Spacing & Layout System
 * Based on UX Design Specification Section 3.3
 * 8px base unit with micro-adjustments via 4px increments
 */

export const spacing = {
	// Spacing Scale (8px base unit)
	xs: '4px',
	sm: '8px',
	md: '12px',
	lg: '16px',
	xl: '24px',
	'2xl': '32px',
	'3xl': '48px',

	// Semantic spacing aliases
	cardGutter: '16px', // lg - Timeline card gutters
	cardPadding: '24px', // xl - Metrics tiles padding
	containerGutter: '24px', // xl - Container horizontal padding
} as const;

/**
 * Layout constraints
 */
export const layout = {
	// Container widths
	maxWidth: '1440px',
	heroRailMinWidth: '340px',

	// Grid configuration
	grid: {
		desktop: 12, // columns at ≥1440px
		laptop: 8, // columns at ≥1024px
		stacked: 1, // columns below 768px
	},

	// Breakpoints (matching Tailwind config)
	breakpoints: {
		sm: '640px',
		md: '768px',
		lg: '1024px',
		xl: '1200px',
		'2xl': '1440px',
	},
} as const;

/**
 * CSS Custom Properties for spacing
 */
export const spacingTokens = {
	'--spacing-xs': spacing.xs,
	'--spacing-sm': spacing.sm,
	'--spacing-md': spacing.md,
	'--spacing-lg': spacing.lg,
	'--spacing-xl': spacing.xl,
	'--spacing-2xl': spacing['2xl'],
	'--spacing-3xl': spacing['3xl'],

	'--layout-max-width': layout.maxWidth,
	'--layout-hero-rail-min-width': layout.heroRailMinWidth,
} as const;

/**
 * Type-safe spacing keys
 */
export type SpacingKey = keyof typeof spacing;
