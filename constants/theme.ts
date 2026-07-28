/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export type ThemeMode = 'dark' | 'light';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderMuted: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textFaint: string;
  textDisabled: string;
  accent: string;
  accentMuted: string;
  accentMutedStrong: string;
  success: string;
  error: string;
  errorMuted: string;
  warning: string;
  warningMuted: string;
  overlay: string;
  statusBar: 'light' | 'dark';
};

// Fragify's actual color system, surveyed from what every screen already
// hardcodes. "dark" is the original/only palette the app shipped with --
// values here must match exactly so converting a screen to use these
// tokens is a no-op visually. "light" is the new palette.
export const Colors: Record<ThemeMode, ThemeColors> = {
  dark: {
    background: '#0a0a0a',
    surface: '#161616',
    surfaceAlt: '#1a1a1a',
    border: '#2a2a2a',
    borderMuted: '#262626',
    textPrimary: '#ffffff',
    textSecondary: '#aaaaaa',
    textTertiary: '#888888',
    textMuted: '#666666',
    textFaint: '#555555',
    textDisabled: '#444444',
    accent: '#7C3AED',
    accentMuted: '#7C3AED18',
    accentMutedStrong: '#7C3AED22',
    success: '#00D4AA',
    error: '#ff4444',
    errorMuted: '#ff444422',
    warning: '#FFB800',
    warningMuted: '#FFB80022',
    overlay: '#000000aa',
    statusBar: 'light',
  },
  light: {
    background: '#f7f7f8',
    surface: '#ffffff',
    surfaceAlt: '#f0f0f2',
    border: '#e2e2e6',
    borderMuted: '#ececef',
    textPrimary: '#111114',
    textSecondary: '#55555c',
    textTertiary: '#75757c',
    textMuted: '#8a8a90',
    textFaint: '#a3a3a8',
    textDisabled: '#c2c2c6',
    accent: '#7C3AED',
    accentMuted: '#7C3AED14',
    accentMutedStrong: '#7C3AED1e',
    success: '#00A886',
    error: '#e63946',
    errorMuted: '#e6394620',
    warning: '#d99400',
    warningMuted: '#d9940020',
    overlay: '#00000066',
    statusBar: 'dark',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
