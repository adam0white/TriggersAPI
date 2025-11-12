/**
 * Design Tokens - Centralized Export
 * Import all design tokens from this single entry point
 */

export * from './colors';
export * from './typography';
export * from './spacing';
export * from './elevation';

import { colorTokens } from './colors';
import { typographyTokens } from './typography';
import { spacingTokens } from './spacing';
import { elevationTokens } from './elevation';

/**
 * All CSS custom properties combined
 * Apply these to :root or document element
 */
export const allTokens = {
	...colorTokens,
	...typographyTokens,
	...spacingTokens,
	...elevationTokens,
} as const;
