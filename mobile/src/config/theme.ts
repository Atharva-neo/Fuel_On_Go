export const Colors = {
  primary: '#00D4AA',
  primaryDark: '#00B894',
  primaryLight: '#55EFC4',
  secondary: '#6C63FF',
  accent: '#FD79A8',

  background: '#0A0E1A',
  surface: '#131929',
  surfaceElevated: '#1C2438',
  surfaceBorder: '#242D45',

  textPrimary: '#FFFFFF',
  textSecondary: '#8892A4',
  textMuted: '#505870',
  textInverse: '#0A0E1A',

  success: '#00D4AA',
  successBg: 'rgba(0,212,170,0.12)',
  warning: '#FDCB6E',
  warningBg: 'rgba(253,203,110,0.12)',
  error: '#FF7675',
  errorBg: 'rgba(255,118,117,0.12)',
  info: '#74B9FF',
  infoBg: 'rgba(116,185,255,0.12)',

  slotAvailable: '#00D4AA',
  slotLimited: '#FDCB6E',
  slotFull: '#636E72',
  slotExpired: '#505870',

  pumpHigh: '#00D4AA',
  pumpMedium: '#FDCB6E',
  pumpLow: '#FF7675',

  gradientStart: '#0A0E1A',
  gradientEnd: '#131929',

  overlay: 'rgba(10,14,26,0.85)',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const Typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    xxl: 30,
    xxxl: 38,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
};
