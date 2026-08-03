// Shared theme definitions for AnimatedProfileBanner + AnimatedAvatarRing --
// kept in one place so the two components (background + ring) always stay
// visually matched for a given theme.
export type BannerTheme = 'aurora' | 'holographic' | 'ember';

export const BANNER_THEMES: { key: BannerTheme; label: string; description: string }[] = [
  { key: 'aurora', label: 'Aurora', description: 'Slow-drifting cool glow — teal, violet, and blue' },
  { key: 'holographic', label: 'Holographic', description: 'Foil-card shimmer sweep across a prism gradient' },
  { key: 'ember', label: 'Ember', description: 'Warm glow with rising embers — for a hot streak' },
];

export const RING_GRADIENTS: Record<BannerTheme, [string, string, ...string[]]> = {
  aurora: ['#2E9BFF', '#7C3AED', '#00D4AA', '#2E9BFF'],
  holographic: ['#FF6EC7', '#7C3AED', '#2E9BFF', '#00E5C7', '#FF6EC7'],
  ember: ['#FF6B35', '#FFB800', '#FF3D3D', '#FF6B35'],
};

export const RING_ROTATE_MS: Record<BannerTheme, number> = {
  aurora: 6000,
  holographic: 3200,
  ember: 5000,
};

export const BASE_GRADIENTS: Record<BannerTheme, [string, string, ...string[]]> = {
  aurora: ['#171233', '#140f2b', '#0c0819'],
  holographic: ['#1c1330', '#160f2b', '#0c0819'],
  ember: ['#2a1410', '#1d0f0c', '#0f0705'],
};
