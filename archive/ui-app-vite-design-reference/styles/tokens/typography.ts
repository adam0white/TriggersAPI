/**
 * Design Tokens - Typography System
 * Based on UX Design Specification Section 3.2
 * Implements Degular for headlines, Inter for body, JetBrains Mono for code
 */

export const typography = {
	// Font Families
	fontFamilies: {
		headline: {
			family: 'Degular, system-ui, sans-serif',
			usage: 'Headlines, section titles (H1, H2, H3)',
			weights: {
				regular: 400,
				medium: 500,
				displayBold: 700,
			},
		},
		body: {
			family: 'Inter, system-ui, sans-serif',
			usage: 'Body text, data, UI elements',
			weights: {
				regular: 400,
				medium: 500,
			},
			features: ['tabular-nums'], // For consistent number alignment
		},
		mono: {
			family: 'JetBrains Mono, Monaco, Courier New, monospace',
			usage: 'Code snippets, log output, technical data',
			weights: {
				regular: 400,
			},
		},
	},

	// Type Scale (rem-based)
	scale: {
		h1: {
			size: '2.5rem', // 40px
			lineHeight: 1.2,
			fontWeight: 700, // Degular Display Bold
			fontFamily: 'headline',
		},
		h2: {
			size: '1.75rem', // 28px
			lineHeight: 1.2,
			fontWeight: 500, // Degular Medium
			fontFamily: 'headline',
		},
		h3: {
			size: '1.5rem', // 24px
			lineHeight: 1.2,
			fontWeight: 500, // Degular Medium
			fontFamily: 'headline',
		},
		body: {
			size: '1rem', // 16px (base)
			lineHeight: 1.45,
			fontWeight: 400, // Inter Regular
			fontFamily: 'body',
		},
		caption: {
			size: '0.875rem', // 14px
			lineHeight: 1.45,
			fontWeight: 500, // Inter Medium
			fontFamily: 'body',
		},
		mono: {
			size: '0.875rem', // 14px
			lineHeight: 1.45,
			fontWeight: 400, // JetBrains Mono Regular
			fontFamily: 'mono',
		},
	},

	// Line Heights
	lineHeights: {
		tight: 1.2, // Headlines
		normal: 1.45, // Body text
		relaxed: 1.6, // Large blocks of text (if needed)
	},
} as const;

/**
 * CSS Custom Properties for typography
 */
export const typographyTokens = {
	'--font-family-headline': typography.fontFamilies.headline.family,
	'--font-family-body': typography.fontFamilies.body.family,
	'--font-family-mono': typography.fontFamilies.mono.family,

	'--font-size-h1': typography.scale.h1.size,
	'--font-size-h2': typography.scale.h2.size,
	'--font-size-h3': typography.scale.h3.size,
	'--font-size-body': typography.scale.body.size,
	'--font-size-caption': typography.scale.caption.size,
	'--font-size-mono': typography.scale.mono.size,

	'--line-height-tight': typography.lineHeights.tight,
	'--line-height-normal': typography.lineHeights.normal,
	'--line-height-relaxed': typography.lineHeights.relaxed,
} as const;

/**
 * Type-safe typography keys
 */
export type TypographyScale = keyof typeof typography.scale;
