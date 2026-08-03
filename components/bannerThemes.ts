// Shared theme definitions for AnimatedProfileBanner + AnimatedAvatarRing --
// kept in one place so the two components (background + ring) always stay
// visually matched for a given theme.
export type BannerTheme = 'powersurge' | 'inferno' | 'turbo';

export const BANNER_THEMES: { key: BannerTheme; label: string; description: string }[] = [
  { key: 'powersurge', label: 'Power Surge', description: 'Radiating gold energy aura with electric sparks' },
  { key: 'inferno', label: 'Inferno', description: 'Roaring dragon fire with rising embers' },
  { key: 'turbo', label: 'Turbo Circuit', description: 'High-speed racing streaks and headlight glow' },
];

export const RING_GRADIENTS: Record<BannerTheme, [string, string, ...string[]]> = {
  powersurge: ['#FFE28A', '#FFB800', '#2E9BFF', '#FFE28A'],
  inferno: ['#FFD23D', '#FF6B35', '#FF1F1F', '#FFD23D'],
  turbo: ['#FFFFFF', '#2E9BFF', '#FF3D3D', '#FFFFFF'],
};

export const RING_ROTATE_MS: Record<BannerTheme, number> = {
  powersurge: 2600,
  inferno: 4200,
  turbo: 1500,
};

export const BASE_GRADIENTS: Record<BannerTheme, [string, string, ...string[]]> = {
  powersurge: ['#1c1706', '#171233', '#0c0819'],
  inferno: ['#2a1410', '#1d0f0c', '#0f0705'],
  turbo: ['#12151a', '#0d1420', '#08090c'],
};
