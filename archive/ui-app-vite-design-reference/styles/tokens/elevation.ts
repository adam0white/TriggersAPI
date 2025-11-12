/**
 * Design Tokens - Elevation System
 * Based on UX Design Specification Section 3.3
 * Box shadows for card states and modals
 */

export const elevation = {
	// Card elevations
	cardBase: {
		border: '1px solid rgba(255, 253, 249, 0.1)',
		boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
		usage: 'Default stage cards, timeline panels',
	},
	cardActive: {
		border: '1px solid #FF4F00',
		boxShadow: '0 0 20px rgba(255, 79, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)',
		usage: 'Active stage with Zap Orange glow effect',
	},

	// Modal/Dialog elevation
	modal: {
		boxShadow: '0 20px 25px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 0, 0, 0.2)',
		backdropFilter: 'blur(16px)',
		usage: 'Dialogs, deep log inspection drawers',
	},

	// Additional utility elevations
	tooltip: {
		boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
		usage: 'Tooltips, popovers',
	},
	dropdown: {
		boxShadow: '0 10px 15px rgba(0, 0, 0, 0.2)',
		usage: 'Dropdown menus, select options',
	},
} as const;

/**
 * CSS Custom Properties for elevation
 */
export const elevationTokens = {
	'--shadow-card-base': elevation.cardBase.boxShadow,
	'--shadow-card-active': elevation.cardActive.boxShadow,
	'--shadow-modal': elevation.modal.boxShadow,
	'--shadow-tooltip': elevation.tooltip.boxShadow,
	'--shadow-dropdown': elevation.dropdown.boxShadow,

	'--border-card-base': elevation.cardBase.border,
	'--border-card-active': elevation.cardActive.border,
} as const;

/**
 * Type-safe elevation keys
 */
export type ElevationKey = keyof typeof elevation;
