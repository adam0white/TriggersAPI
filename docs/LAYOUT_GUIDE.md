# Layout Guide - Two-Column Responsive Dashboard

**Story 7.1: Design Tokens & Layout Shell**

## Overview

The Mission-Control Pulse Dashboard uses a two-column responsive layout that adapts across five breakpoints: desktop (≥1440px), large laptop (≥1200px), laptop (≥1024px), tablet (768-1199px), and mobile (<768px).

## Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│                    DashboardLayout                      │
│  ┌──────────────┐  ┌─────────────────────────────────┐ │
│  │   Column 1   │  │          Column 2               │ │
│  │  (Primary)   │  │      (Telemetry Stack)          │ │
│  │              │  │                                 │ │
│  │ ┌──────────┐ │  │  ┌─────────────────────────┐   │ │
│  │ │  Sticky  │ │  │  │   Logs Panel           │   │ │
│  │ │ Run Cmd  │ │  │  └─────────────────────────┘   │ │
│  │ └──────────┘ │  │  ┌─────────────────────────┐   │ │
│  │              │  │  │   Inbox Panel          │   │ │
│  │ ┌──────────┐ │  │  └─────────────────────────┘   │ │
│  │ │Scrollable│ │  │  ┌─────────────────────────┐   │ │
│  │ │ Timeline │ │  │  │   Metrics Panel        │   │ │
│  │ │          │ │  │  └─────────────────────────┘   │ │
│  │ │          │ │  │  ┌─────────────────────────┐   │ │
│  │ │          │ │  │  │   History Panel        │   │ │
│  │ └──────────┘ │  │  └─────────────────────────┘   │ │
│  └──────────────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Responsive Breakpoints

### Desktop (≥1440px) - 2xl

**Layout:** Two columns side-by-side
- Column 1: `minmax(340px, 1fr)` (min-width maintained)
- Column 2: `2fr` (flexes to fill remaining space)
- Gap: `xl` (24px)
- Container max-width: 1440px

**Behavior:**
- Run Command panel sticky at top of Column 1
- Timeline scrolls independently within Column 1
- All telemetry panels visible in Column 2 (accordion)
- One panel expanded by default (Logs)

### Large Laptop (≥1200px) - xl

**Layout:** Two columns maintained
- Columns slightly narrower
- Timeline cards compress (reduced padding)
- Metrics tiles switch to 2-up grid

**No functional changes from desktop.**

### Laptop (≥1024px) - lg

**Layout:** Two columns maintained
- Further compression
- Accordion behavior more prominent in Column 2

### Tablet (768-1199px) - md

**Layout:** Columns stack vertically
- Column 1 on top (Run Command + Timeline)
- Column 2 below (Telemetry panels)

**Behavior:**
- Run Command remains sticky at viewport top
- Timeline cards adapt to narrower width
- Accordion panels collapsed by default
- User can expand one panel at a time
- Touch targets ≥48px for mobile usability

### Mobile (<768px)

**Layout:** Single column
- Run Command at top (sticky or floating button)
- Timeline converts to vertical stepper
- Telemetry panels in collapsed accordion

**Behavior:**
- Horizontal scroll disabled
- Cards stack vertically with connecting lines
- Bottom floating action button for "Run Event"
- Touch-friendly spacing (minimum 48px targets)

## Component API

### DashboardLayout

Main container with responsive grid.

```tsx
import { DashboardLayout } from '@/components/layouts';

<DashboardLayout className="custom-class">
  {/* Column 1 and Column 2 */}
</DashboardLayout>
```

**Props:**
- `children`: React.ReactNode
- `className?`: string (optional)

**Accessibility:**
- `role="main"`
- `aria-label="Mission Control Pulse Dashboard"`

### Column1

Primary column with sticky and scrollable sections.

```tsx
import { Column1, StickySection, ScrollableSection } from '@/components/layouts';

<Column1>
  <StickySection>
    <RunCommandPanel />
  </StickySection>
  <ScrollableSection>
    <EventTimeline />
  </ScrollableSection>
</Column1>
```

**Props:**
- `children`: React.ReactNode
- `className?`: string (optional)

**Features:**
- Minimum width of 340px on desktop
- Sticky positioning for Run Command
- Independent scrolling for Timeline

**Accessibility:**
- `role="region"`
- `aria-label="Primary Control Panel"`

### Column2

Secondary column with collapsible telemetry panels.

```tsx
import { Column2, TelemetryPanel } from '@/components/layouts';

<Column2 defaultExpanded="logs">
  <TelemetryPanel id="logs" title="Live Logs" icon={<Icon />} badge={3}>
    <LogsPanel />
  </TelemetryPanel>
  {/* More panels */}
</Column2>
```

**Props:**
- `children`: React.ReactNode
- `className?`: string (optional)
- `defaultExpanded?`: string (panel ID to expand by default)

**TelemetryPanel Props:**
- `id`: string (unique identifier)
- `title`: string (panel heading)
- `children`: React.ReactNode
- `icon?`: React.ReactNode (optional icon)
- `badge?`: string | number (optional badge count)
- `className?`: string (optional)

**Features:**
- Radix UI Accordion for collapsible behavior
- One panel expanded at a time (single mode)
- Animated expand/collapse transitions
- Keyboard navigation support

**Accessibility:**
- `role="region"`
- `aria-label="Telemetry Panels"`
- `aria-expanded` on accordion triggers
- Keyboard support: Space/Enter to toggle

## Sticky Behavior

### Column 1 - Run Command Panel

```tsx
<StickySection>
  <RunCommandPanel />
</StickySection>
```

- Positioned at `top: 0` with `z-index: 10`
- Remains visible while scrolling timeline
- Background color matches dashboard surface

### Performance Considerations

- No layout shift (CLS < 0.1)
- GPU-accelerated sticky positioning
- No JavaScript-based scroll listeners needed

## Responsive Testing Checklist

### Desktop (1440px+)
- [ ] Two columns side-by-side
- [ ] Run Command sticky at top
- [ ] Timeline scrolls independently
- [ ] No horizontal scroll
- [ ] Telemetry panels collapsible

### Large Laptop (1200px-1439px)
- [ ] Two columns maintained
- [ ] Timeline cards compress gracefully
- [ ] Metrics tiles in 2-up grid

### Tablet (768px-1199px)
- [ ] Columns stack vertically
- [ ] Run Command sticky at viewport top
- [ ] Accordion panels collapsed by default
- [ ] Touch targets ≥48px

### Mobile (<768px)
- [ ] Single column layout
- [ ] Timeline as vertical stepper
- [ ] No horizontal scroll
- [ ] Floating action button for primary CTA
- [ ] Touch-friendly spacing

## Accessibility Features

### Semantic HTML

```html
<main role="main" aria-label="Mission Control Pulse Dashboard">
  <aside role="region" aria-label="Primary Control Panel">
    <!-- Column 1 content -->
  </aside>
  <aside role="region" aria-label="Telemetry Panels">
    <!-- Column 2 content -->
  </aside>
</main>
```

### Keyboard Navigation

- **Tab/Shift+Tab:** Move between focusable elements
- **Space/Enter:** Toggle accordion panels
- **Arrow Keys:** Navigate within accordion (Radix default)
- **Escape:** Close expanded panels (optional)

### Screen Reader Support

- ARIA landmarks (`main`, `region`)
- ARIA labels for layout sections
- ARIA live regions for dynamic updates (future)
- Proper heading hierarchy (H1 > H2 > H3)

### Focus Management

All interactive elements include visible focus indicators:
```css
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

## CSS Grid Configuration

### Desktop Layout

```css
.dashboard-layout {
  display: grid;
  grid-template-columns: minmax(340px, 1fr) 2fr;
  gap: var(--spacing-xl);
  max-width: var(--layout-max-width);
  margin: 0 auto;
  padding: var(--spacing-xl);
}
```

### Tablet/Mobile Layout

```css
@media (max-width: 1199px) {
  .dashboard-layout {
    grid-template-columns: 1fr;
  }
}
```

## Usage Examples

### Basic Layout

```tsx
import { Dashboard } from '@/pages/Dashboard';

function App() {
  return <Dashboard />;
}
```

### Custom Layout

```tsx
import {
  DashboardLayout,
  Column1,
  Column2,
  StickySection,
  ScrollableSection,
  TelemetryPanel,
} from '@/components/layouts';

<DashboardLayout>
  <Column1>
    <StickySection>
      <CustomRunPanel />
    </StickySection>
    <ScrollableSection>
      <CustomTimeline />
    </ScrollableSection>
  </Column1>

  <Column2 defaultExpanded="custom-panel">
    <TelemetryPanel id="custom-panel" title="Custom Panel">
      <CustomContent />
    </TelemetryPanel>
  </Column2>
</DashboardLayout>
```

## Related Documentation

- [Design Tokens Guide](./DESIGN_TOKENS.md)
- [Component Documentation](../src/ui-app/components/README.md)
- [UX Design Specification](./ux-design-specification.md) - Section 4.1
- [Story 7.1](../stories/7.1-design-tokens-layout-shell.md)

---

**Created:** 2025-11-12
**Story:** 7.1 - Design Tokens & Layout Shell
