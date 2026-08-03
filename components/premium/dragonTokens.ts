// Palette + density presets for the "Dragon's Wrath" banner.
// Split from the components so the layer engine stays theme-agnostic.

export type DragonIntensity = 'subtle' | 'balanced' | 'vivid';

export const DRAGON = {
  // Base is near-black with a red bias -- true #000 flattens the lava glow.
  base: ['#0B0506', '#1A0A09', '#070405'] as [string, string, ...string[]],
  obsidian: '#0A0506',
  ash: '#170C0D',
  smoke: '#1C1517',
  // A trace of purple in the shadows keeps the darks from going muddy brown.
  shadowPurple: '#2A1030',
  crimson: '#7A1420',
  deepRed: '#B3261E',
  burnt: '#E05A18',
  molten: '#FF7A18',
  lava: '#FFB43D',
  gold: '#FFD98A',
  emberCore: '#FFE9B0',
};

type DragonConfig = {
  emberCount: number;
  sparkCount: number;
  smokeCount: number;
  smokeOpacity: number;
  roarPeak: number;
  showHeatHaze: boolean;
};

export const DRAGON_INTENSITY: Record<DragonIntensity, DragonConfig> = {
  subtle:   { emberCount: 10, sparkCount: 3, smokeCount: 2, smokeOpacity: 0.35, roarPeak: 0.5, showHeatHaze: true },
  balanced: { emberCount: 16, sparkCount: 5, smokeCount: 3, smokeOpacity: 0.5,  roarPeak: 0.75, showHeatHaze: true },
  vivid:    { emberCount: 24, sparkCount: 7, smokeCount: 4, smokeOpacity: 0.65, roarPeak: 1.0, showHeatHaze: true },
};

// Applied on top of the chosen intensity. Drops the two most expensive layers
// (per-frame SVG-heavy smoke and the haze overlay) and thins the particles,
// for older devices that can't hold 60fps on the full stack.
export const LOW_PERFORMANCE_OVERRIDE: Partial<DragonConfig> = {
  emberCount: 6,
  sparkCount: 2,
  smokeCount: 1,
  showHeatHaze: false,
};

export function resolveDragonConfig(intensity: DragonIntensity, lowPerformance?: boolean): DragonConfig {
  const base = DRAGON_INTENSITY[intensity];
  return lowPerformance ? { ...base, ...LOW_PERFORMANCE_OVERRIDE } : base;
}
