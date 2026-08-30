/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#241437',
    tint: '#5B2C83',

    // Core surfaces
    background: '#F7F3FC',
    foreground: '#241437',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#241437',

    // Primary action color (buttons, links, active states)
    primary: '#5B2C83',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#EDE7FF',
    secondaryForeground: '#5B2C83',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#F0EBF8',
    mutedForeground: '#756A82',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#E4D8FF',
    accentForeground: '#5B2C83',

    // Destructive actions (delete, error states)
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#DED4EA',
    input: '#DED4EA',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
