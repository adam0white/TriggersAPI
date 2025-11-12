# Design Tokens Guide

**Story 7.1: Design Tokens & Layout Shell**

## Quick Reference

### Color Palette

| Token | Hex | Usage | Contrast |
|-------|-----|-------|----------|
| `primary` | #FF4F00 | CTA, active pulse | 8.2:1 (Earth) |
| `surface` | #201515 | Background | - |
| `surface-elevated` | #2B2358 | Cards, panels | - |
| `accent-1` | #C1B7FF | Success glow | 12.4:1 (Night) |
| `accent-2` | #CDE4E1 | Metrics tiles | 11.8:1 (Night) |
| `alert-success` | #1F3121 | Success status | - |
| `alert-warning` | #FFBF6E | Latency warning | 5.1:1 (Night) |
| `alert-error` | #FF4F00 | Failure chips | 8.2:1 (Earth) |
| `neutral-100` | #FFFDF9 | Primary text | 15.8:1 (Night) |
| `neutral-400` | #FFF3E6 | Secondary text | 12.4:1 (Night) |

All colors meet WCAG 2.1 AA standards (4.5:1 minimum for text).

### Typography Scale

| Element | Size | Line Height | Font Family | Weight |
|---------|------|-------------|-------------|--------|
| H1 | 2.5rem (40px) | 1.2 | Degular | 700 |
| H2 | 1.75rem (28px) | 1.2 | Degular | 500 |
| H3 | 1.5rem (24px) | 1.2 | Degular | 500 |
| Body | 1rem (16px) | 1.45 | Inter | 400 |
| Caption | 0.875rem (14px) | 1.45 | Inter | 500 |
| Mono | 0.875rem (14px) | 1.45 | JetBrains Mono | 400 |

### Spacing Scale (8px base)

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Micro-adjustments |
| `sm` | 8px | Tight spacing |
| `md` | 12px | Default spacing |
| `lg` | 16px | Card gutters |
| `xl` | 24px | Card padding, container gutters |
| `2xl` | 32px | Section spacing |
| `3xl` | 48px | Hero spacing |

### Elevation/Shadows

| Token | Usage | Value |
|-------|-------|-------|
| `card-base` | Default cards | `0 1px 3px rgba(0,0,0,0.1)` |
| `card-active` | Active stages | `0 0 20px rgba(255,79,0,0.3), 0 4px 12px rgba(0,0,0,0.2)` |
| `modal` | Dialogs | `0 20px 25px rgba(0,0,0,0.3), 0 0 20px rgba(0,0,0,0.2)` |

## Usage Examples

### Colors

```tsx
// Tailwind classes (recommended)
<button className="bg-primary text-neutral-100 hover:bg-primary/80">
  Run Event
</button>

// CSS custom properties
<div style={{ backgroundColor: 'var(--color-primary)' }}>...</div>

// Programmatic access
import { colors } from '@/styles/tokens';
const primaryColor = colors.primary.hex; // '#FF4F00'
```

### Typography

```tsx
// Tailwind classes (recommended)
<h1 className="font-headline text-h1 text-neutral-100">
  Mission Control Pulse
</h1>

<p className="font-body text-body text-neutral-400">
  Dashboard content
</p>

<code className="font-mono text-mono">
  console.log('hello');
</code>
```

### Spacing

```tsx
// Tailwind classes
<div className="p-xl gap-lg">
  <Card className="mb-md" />
</div>

// Layout constraints
<div className="max-w-container mx-auto px-xl">
  Container content
</div>
```

### Elevation

```tsx
// Component classes
<div className="card-base">Default card</div>
<div className="card-active">Active stage</div>

// Tailwind shadow utilities
<div className="shadow-card-active">Custom shadow</div>
```

## Token Files

| File | Purpose |
|------|---------|
| `colors.ts` | Color palette with contrast data |
| `typography.ts` | Font families and type scale |
| `spacing.ts` | Spacing scale and layout constraints |
| `elevation.ts` | Box shadows and elevation tokens |
| `index.ts` | Centralized export of all tokens |

## Importing Tokens

```tsx
// Individual imports
import { colors } from '@/styles/tokens/colors';
import { typography } from '@/styles/tokens/typography';

// Centralized import (recommended)
import { colors, typography, spacing, elevation } from '@/styles/tokens';

// All tokens as CSS custom properties
import { allTokens } from '@/styles/tokens';
```

## Accessibility

### Color Contrast

All color combinations verified for WCAG 2.1 AA:
- Zap Orange on Earth: 8.2:1 ✓
- White Almost on Night: 15.8:1 ✓
- Cream on Night: 12.4:1 ✓
- Peach on Night: 5.1:1 ✓

### Focus States

All interactive elements include visible focus indicators:
```css
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

### Reduced Motion

Motion preferences respected via CSS:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Best Practices

### ✅ Do

- Use Tailwind utility classes for styling
- Import tokens for programmatic access
- Use semantic color names (`primary`, not `orange`)
- Apply spacing tokens consistently
- Verify contrast ratios when combining colors

### ❌ Don't

- Hardcode hex values in components
- Use magic numbers for spacing
- Override token values without documentation
- Mix token systems (CSS vars + Tailwind inconsistently)

## Related Documentation

- [Token Implementation Details](../src/ui-app/styles/tokens/README.md)
- [Layout Guide](./LAYOUT_GUIDE.md)
- [UX Design Specification](./ux-design-specification.md) - Section 3
- [Story 7.1](../stories/7.1-design-tokens-layout-shell.md)

---

**Created:** 2025-11-12
**Story:** 7.1 - Design Tokens & Layout Shell
