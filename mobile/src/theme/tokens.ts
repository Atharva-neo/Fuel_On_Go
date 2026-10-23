import { BRAND_GREEN, latte, mocha } from './palettes.ts';

export interface ThemeColors {
  // surfaces
  bg: string;
  bgAlt: string;
  surface: string;
  surfaceAlt: string; // recessed / subtle fill (chips, inset areas)
  surfaceRaised: string; // modals, dropdowns, bottom sheets
  scrim: string;
  // text
  text: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  // lines
  border: string;
  divider: string;
  focus: string;
  shadow: string;
  // inputs
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  // brand green
  brand: string;
  brandPressed: string;
  brandDisabled: string;
  brandText: string; // brand-coloured text/icons on surfaces
  brandTint: string; // subtle brand-coloured fill
  onBrand: string;
  // status: solid fill, readable-as-text variant, tint, text on the solid fill
  success: string; successText: string; successTint: string; onSuccess: string;
  warning: string; warningText: string; warningTint: string; onWarning: string;
  danger: string; dangerText: string; dangerTint: string; onDanger: string;
  info: string; infoText: string; infoTint: string; onInfo: string;
  // strong neutral button (light in Mocha, dark in Latte)
  inverse: string;
  onInverse: string;
  // rating stars (filled vs empty also differ by icon shape, never colour alone)
  star: string;
  starEmpty: string;
  // QR codes stay black-on-white in every theme (scanners cannot read inverted codes)
  qrBackground: string;
  qrForeground: string;
  // over a live camera feed (arbitrary background): identical in both themes on purpose
  cameraScrim: string;
  onCamera: string;
  cameraControl: string;
  // map
  mapControlBg: string;
  mapControlIcon: string;
  mapPopupBg: string;
  markerPump: string;
  markerUser: string;
  markerStale: string;
}

export interface Theme {
  name: 'mocha' | 'latte';
  isDark: boolean;
  colors: ThemeColors;
}

export const mochaTheme: Theme = {
  name: 'mocha',
  isDark: true,
  colors: {
    bg: mocha.base,
    bgAlt: mocha.mantle,
    surface: mocha.surface0,
    surfaceAlt: mocha.mantle,
    surfaceRaised: mocha.surface0,
    scrim: 'rgba(17,17,27,0.72)',
    text: mocha.text,
    textSecondary: mocha.subtext0,
    textMuted: mocha.overlay2,
    textDisabled: mocha.overlay0,
    border: mocha.surface1,
    divider: mocha.surface0,
    focus: mocha.lavender,
    shadow: mocha.crust,
    inputBg: mocha.mantle,
    inputBorder: mocha.surface1,
    placeholder: mocha.overlay1,
    brand: BRAND_GREEN,
    brandPressed: '#00a87e',
    brandDisabled: 'rgba(0,200,150,0.35)',
    brandText: BRAND_GREEN,
    brandTint: 'rgba(0,200,150,0.14)',
    onBrand: mocha.crust,
    success: mocha.green, successText: mocha.green, successTint: 'rgba(166,227,161,0.14)', onSuccess: mocha.crust,
    warning: mocha.yellow, warningText: mocha.yellow, warningTint: 'rgba(249,226,175,0.14)', onWarning: mocha.crust,
    danger: mocha.red, dangerText: mocha.red, dangerTint: 'rgba(243,139,168,0.14)', onDanger: mocha.crust,
    info: mocha.blue, infoText: mocha.blue, infoTint: 'rgba(137,180,250,0.14)', onInfo: mocha.crust,
    inverse: mocha.text,
    onInverse: mocha.base,
    star: mocha.yellow,
    starEmpty: mocha.overlay1,
    qrBackground: '#ffffff',
    qrForeground: '#000000',
    cameraScrim: 'rgba(17,17,27,0.72)',
    onCamera: mocha.text,
    cameraControl: 'rgba(205,214,244,0.16)',
    mapControlBg: mocha.surface0,
    mapControlIcon: mocha.text,
    mapPopupBg: mocha.surface0,
    markerPump: BRAND_GREEN,
    markerUser: mocha.blue,
    markerStale: mocha.overlay1,
  },
};

// Latte note: solid status fills use the darkened variants (not the raw Latte
// green/red/blue) so white button text passes WCAG AA.
export const latteTheme: Theme = {
  name: 'latte',
  isDark: false,
  colors: {
    bg: latte.base,
    bgAlt: latte.mantle,
    surface: latte.mantle,
    surfaceAlt: latte.crust,
    surfaceRaised: latte.base,
    scrim: 'rgba(76,79,105,0.45)',
    text: latte.text,
    textSecondary: latte.subtext1,
    textMuted: latte.subtext0,
    textDisabled: latte.overlay1,
    border: latte.surface0,
    divider: latte.surface0,
    focus: latte.blue,
    shadow: latte.text,
    inputBg: latte.base,
    inputBorder: latte.surface1,
    placeholder: latte.overlay1,
    brand: BRAND_GREEN,
    brandPressed: '#00a87e',
    brandDisabled: 'rgba(0,200,150,0.35)',
    brandText: '#006b4e',
    brandTint: 'rgba(0,200,150,0.18)',
    onBrand: mocha.crust,
    success: '#23700f', successText: '#23700f', successTint: 'rgba(64,160,43,0.14)', onSuccess: '#ffffff',
    warning: latte.yellow, warningText: '#8a5200', warningTint: 'rgba(223,142,29,0.16)', onWarning: mocha.crust,
    danger: '#b80c30', dangerText: '#b80c30', dangerTint: 'rgba(210,15,57,0.10)', onDanger: '#ffffff',
    info: '#1750d6', infoText: '#1750d6', infoTint: 'rgba(30,102,245,0.10)', onInfo: '#ffffff',
    inverse: latte.text,
    onInverse: latte.base,
    star: '#b45f06', // darkened Latte yellow: 3.8:1 on Latte surfaces (raw yellow is 2.2:1)
    starEmpty: latte.overlay2,
    qrBackground: '#ffffff',
    qrForeground: '#000000',
    cameraScrim: 'rgba(17,17,27,0.72)',
    onCamera: mocha.text,
    cameraControl: 'rgba(205,214,244,0.16)',
    mapControlBg: latte.base,
    mapControlIcon: latte.text,
    mapPopupBg: latte.base,
    markerPump: BRAND_GREEN,
    markerUser: latte.blue,
    markerStale: latte.overlay1,
  },
};

export const themes = { mocha: mochaTheme, latte: latteTheme } as const;
