# Font Files

## Required Fonts

### Degular (Zapier Brand Font)
- **License**: Commercial - requires Zapier license
- **Files needed**:
  - `Degular-Regular.woff2`
  - `Degular-Medium.woff2`
  - `Degular-Bold.woff2`
- **Usage**: Headlines (H1, H2, H3)
- **Fallback**: System UI fonts (already configured)

### Inter (Body Font)
- **License**: Open Font License (free)
- **Source**: https://fonts.google.com/specimen/Inter
- **Files needed**:
  - `Inter-Regular.woff2`
  - `Inter-Medium.woff2`
- **Usage**: Body text, UI elements, data display
- **Fallback**: System UI fonts (already configured)

### JetBrains Mono (Monospace Font)
- **License**: Apache License 2.0 (free)
- **Source**: https://www.jetbrains.com/lp/mono/
- **Files needed**:
  - `JetBrainsMono-Regular.woff2`
- **Usage**: Code snippets, log output
- **Fallback**: Monaco, Courier New (already configured)

## Installation

1. **Inter**: Download from Google Fonts or use CDN
2. **JetBrains Mono**: Download from JetBrains website
3. **Degular**: Contact Zapier design team for licensed files

## Temporary Setup

For development, the app uses system font fallbacks:
- **Headlines**: system-ui, -apple-system, sans-serif
- **Body**: system-ui, -apple-system, sans-serif (with tabular nums)
- **Mono**: Monaco, Menlo, Courier New, monospace

Font loading performance is optimized with `font-display: swap` to prevent text flash.
