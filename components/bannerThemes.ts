// Shared theme definitions for AnimatedProfileBanner + AnimatedAvatarRing --
// kept in one place so the two components (background + ring) always stay
// visually matched for a given theme.
export type BannerTheme = 'powersurge' | 'turbo' | 'nebula' | 'dragonwrath';

// Themes that render their own full composition (background + avatar) instead
// of layering onto the shared base gradient.
export const PREMIUM_THEMES: BannerTheme[] = ['nebula', 'dragonwrath'];

export const BANNER_THEMES: { key: BannerTheme; label: string; description: string; premium?: boolean }[] = [
  { key: 'powersurge', label: 'Power Surge', description: 'Radiating gold energy aura with electric sparks and meteors', premium: true },
  { key: 'turbo', label: 'Turbo Circuit', description: 'High-speed racing streaks and headlight glow', premium: true },
  { key: 'nebula', label: 'Nebula', description: 'Deep-space clouds, drifting stars and a slow light sweep', premium: true },
  { key: 'dragonwrath', label: "Dragon's Wrath", description: 'A living volcano of molten lava, fire and smoke', premium: true },
];

export const RING_GRADIENTS: Record<BannerTheme, [string, string, ...string[]]> = {
  powersurge: ['#FFE28A', '#FFB800', '#2E9BFF', '#FFE28A'],
  turbo: ['#FFFFFF', '#2E9BFF', '#FF3D3D', '#FFFFFF'],
  // Nebula renders its own avatar treatment (PremiumAvatarAura); this entry
  // exists only so the maps stay total over BannerTheme.
  nebula: ['#7FE6FF', '#4DB7FF', '#6C3EFF', '#7FE6FF'],
  dragonwrath: ['#FFD98A', '#FF7A18', '#B3261E', '#FFD98A'],
};

export const RING_ROTATE_MS: Record<BannerTheme, number> = {
  powersurge: 2600,
  turbo: 1500,
  nebula: 9000,
  dragonwrath: 6200,
};

export const BASE_GRADIENTS: Record<BannerTheme, [string, string, ...string[]]> = {
  powersurge: ['#1c1706', '#171233', '#0c0819'],
  turbo: ['#12151a', '#0d1420', '#08090c'],
  nebula: ['#07060F', '#0C0A1B', '#050409'],
  dragonwrath: ['#0B0506', '#1A0A09', '#070405'],
};
