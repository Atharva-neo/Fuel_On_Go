// Stitch-style Design Tokens for Fuel on Go
// White/Light theme inspired by Google/Uber — clean, minimal, premium

export const colors = {
  // Brand
  primary:      '#1a73e8',  // Google Blue / Uber Blue
  primaryLight: '#e8f0fe',  // Light blue bg
  primaryDark:  '#1557b0',  // Pressed blue

  // Semantic
  success:      '#0f9d58',  // Green — available slots
  successBg:    '#e6f4ea',  // Light green bg
  warning:      '#f4b400',  // Orange — low availability
  warningBg:    '#fef7e0',  // Light orange bg
  danger:       '#d93025',  // Red — full / error
  dangerBg:     '#fce8e6',  // Light red bg
  secondary:    '#1a73e8',  // Same as primary

  // Backgrounds (WHITE THEME)
  bg:           '#ffffff',  // Main white background
  bgCard:       '#ffffff',  // Card background (white with shadow)
  bgInput:      '#ffffff',  // Input background
  bgSheet:      '#ffffff',  // Bottom sheet background
  surface:      '#f8f9fa',  // Light gray surface
  surface2:     '#f1f3f4',  // Slightly darker surface

  // Text
  textPrimary:   '#202124', // Near black
  textSecondary: '#5f6368', // Medium gray
  textMuted:     '#9aa0a6', // Light gray
  textHint:      '#bdc1c6', // Very light gray

  // Borders
  border:        '#dadce0', // Light border
  borderFocus:   '#1a73e8', // Blue border on focus

  // Slot status (using white-theme appropriate colors)
  slotAvailable: '#0f9d58',
  slotFull:      '#f1f3f4',
  slotExpired:   '#f8f9fa',
  slotDeactivated: '#f4b400',
  slotMine:      '#e8f0fe',

  // Semantic overlays (lighter for white theme)
  infoBg:        '#e8f0fe',
  overlay:       'rgba(0,0,0,0.5)',

  // Base
  white:         '#ffffff',
  black:         '#000000',
  transparent:   'transparent',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
} as const;

export const fontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  30,
  xxxl: 38,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  float: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

// Convenience grouping
const stitch = {
  colors,
  spacing,
  radius,
  fonts,
  fontSize,
  shadows,
};

export default stitch;
