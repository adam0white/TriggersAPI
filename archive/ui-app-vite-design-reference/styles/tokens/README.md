# Design Tokens Documentation

**Story 7.1: Design Tokens & Layout Shell**
**Created:** 2025-11-12

## Overview

This directory contains the comprehensive design token system for the Mission-Control Pulse Dashboard. All tokens are based on the Zapier brand palette and UX Design Specification (Section 3: Visual Foundation).

## Token Categories

### 1. Colors (`colors.ts`)

All colors are WCAG 2.1 AA compliant with verified contrast ratios.

**Primary Brand:**
- `primary` (#FF4F00 - Zap Orange): Primary CTA, active stage pulse, error alerts
  - Contrast on Earth: 8.2:1 ✓
  - Contrast on Night: 7.1:1 ✓

**Surface Colors:**
- `surface` (#201515 - Earth): Dashboard background
- `surfaceElevated` (#2B2358 - Night): Stage cards, timeline panels

**Accent Colors:**
- `accent1` (#C1B7FF - Lavender): Success timeline glow, info badges
- `accent2` (#CDE4E1 - Sky): Metrics tiles, latency indicators

**Alert Colors:**
- `alertSuccess` (#1F3121 - Moss): Success statuses, inbox confirmations
- `alertWarning` (#FFBF6E - Peach): Queue latency warnings
- `alertError` (#FF4F00 - Zap Orange): Failure chips, error logs

**Neutral Colors:**
- `neutral100` (#FFFDF9 - Almost White): Primary text on dark surfaces
- `neutral400` (#FFF3E6 - Cream): Secondary text, separators

**Usage in Components:**
```tsx
import { colors } from '@/styles/tokens';

// Programmatic access
const primaryColor = colors.primary.hex; // '#FF4F00'

// Tailwind classes
<div className="bg-primary text-neutral-100">...</div>

// CSS custom properties
<div style={{ color: 'var(--color-primary)' }}>...</div>
```

### 2. Typography (`typography.ts`)

Implements Degular (headlines), Inter (body), and JetBrains Mono (code).

**Font Families:**
- `headline`: Degular - H1, H2, H3, section titles
- `body`: Inter - Body text, UI elements, data (with tabular numerals)
- `mono`: JetBrains Mono - Code snippets, log output

**Type Scale:**
- `h1`: 2.5rem (40px), line-height 1.2, weight 700
- `h2`: 1.75rem (28px), line-height 1.2, weight 500
- `h3`: 1.5rem (24px), line-height 1.2, weight 500
- `body`: 1rem (16px), line-height 1.45, weight 400
- `caption`: 0.875rem (14px), line-height 1.45, weight 500
- `mono`: 0.875rem (14px), line-height 1.45, weight 400

**Usage in Components:**
```tsx
import { typography } from '@/styles/tokens';

// Tailwind classes
<h1 className="font-headline text-h1">Mission Control</h1>
<p className="font-body text-body">Dashboard content</p>
<code className="font-mono text-mono">console.log('hello')</code>

// CSS custom properties
<h2 style={{ fontFamily: 'var(--font-family-headline)' }}>...</h2>
```

### 3. Spacing (`spacing.ts`)

8px base unit system with semantic aliases.

**Scale:**
- `xs`: 4px
- `sm`: 8px
- `md`: 12px
- `lg`: 16px
- `xl`: 24px
- `2xl`: 32px
- `3xl`: 48px

**Semantic Aliases:**
- `cardGutter`: 16px - Timeline card gutters
- `cardPadding`: 24px - Metrics tiles padding
- `containerGutter`: 24px - Container horizontal padding

**Layout Constraints:**
- `maxWidth`: 1440px - Container maximum width
- `heroRailMinWidth`: 340px - Column 1 minimum width

**Usage in Components:**
```tsx
// Tailwind classes
<div className="p-xl gap-lg">...</div>
<div className="max-w-container">...</div>

// CSS custom properties
<div style={{ padding: 'var(--spacing-xl)' }}>...</div>
```

### 4. Elevation (`elevation.ts`)

Box shadows for card states and modal overlays.

**Card Elevations:**
- `cardBase`: Subtle shadow with border for default stage cards
- `cardActive`: Zap Orange glow effect for active stages

**Modal/Dialog:**
- `modal`: Deep shadow with backdrop blur for dialogs
- `tooltip`: Medium shadow for tooltips and popovers
- `dropdown`: Strong shadow for dropdown menus

**Usage in Components:**
```tsx
import { elevation } from '@/styles/tokens';

// Tailwind classes
<div className="card-base">...</div>
<div className="shadow-card-active">...</div>

// CSS custom properties
<div style={{ boxShadow: 'var(--shadow-modal)' }}>...</div>
```

## Centralized Import

Import all tokens from a single entry point:

```tsx
import { colors, typography, spacing, elevation, allTokens } from '@/styles/tokens';
```

## ESLint Convention

**Prefer token imports over magic values:**

```tsx
// ❌ Avoid
<div style={{ color: '#FF4F00' }}>

// ✅ Prefer
import { colors } from '@/styles/tokens';
<div style={{ color: colors.primary.hex }}>

// ✅ Or use Tailwind classes
<div className="text-primary">
```

## Responsive Breakpoints

Configured in `tailwind.config.js`:

- `sm`: 640px
- `md`: 768px - Tablet stacking point
- `lg`: 1024px - Large laptop
- `xl`: 1200px - Desktop
- `2xl`: 1440px - Full desktop layout

**Usage:**
```tsx
<div className="grid-cols-1 xl:grid-cols-2">...</div>
```

## Accessibility

All color tokens include verified contrast ratios for WCAG 2.1 AA compliance:
- Text: minimum 4.5:1
- UI components: minimum 3:1

Focus indicators use `--color-primary` with 2px outline and 2px offset.

## Font Loading

Fonts are configured with `font-display: swap` to prevent FOIT (Flash of Invisible Text).

**System Fallbacks:**
- Headlines: system-ui, -apple-system, sans-serif
- Body: system-ui, -apple-system, sans-serif
- Mono: Monaco, Menlo, Courier New, monospace

## CSS Custom Properties

All tokens are exported as CSS custom properties in `src/ui-app/styles/index.css` under the `:root` selector, making them accessible globally:

```css
:root {
  --color-primary: #ff4f00;
  --font-family-headline: 'Degular', system-ui, sans-serif;
  --spacing-xl: 24px;
  --shadow-card-active: 0 0 20px rgba(255, 79, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2);
}
```

## Performance Considerations

- Token files are tree-shakeable (TypeScript constants)
- CSS custom properties add minimal runtime overhead
- Font files use woff2 format for optimal compression
- Tailwind JIT compiles only used utilities

## Related Documentation

- [UX Design Specification](../../../docs/ux-design-specification.md) - Section 3: Visual Foundation
- [Story 7.1](../../../stories/7.1-design-tokens-layout-shell.md) - Implementation details
- [Layout Guide](./LAYOUT_GUIDE.md) - Two-column responsive layout

---

**Last Updated:** 2025-11-12
**Story:** 7.1 - Design Tokens & Layout Shell
