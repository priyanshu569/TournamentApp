// Palette + density presets for the "Monarch" butterfly banner.
// Split from the components so the layer engine stays theme-agnostic --
// same split as premiumTokens.ts (Nebula) and dragonTokens.ts.

export type MonarchIntensity = 'subtle' | 'balanced' | 'vivid';

export const MONARCH = {
  // A twilight garden: indigo shading into a faint teal. Never pure black --
  // the wings are the brightest thing on this card and need a surface with
  // some colour in it to sit against, or they read as stickers.
  base: ['#0A0618', '#150C33', '#07161F'] as [string, string, ...string[]],
  violet: '#8B5CF6',
  indigo: '#6C3EFF',
  cyan: '#4DD9FF',
  mint: '#7CF5C4',
  rose: '#FF6FD8',
  blush: '#FF4D8D',
  amber: '#FFC46B',
  coral: '#FF7A5C',
  pollen: '#FFE9B0',
  ray: '#DDE9FF',
  body: '#160E2C',
};

// [tip, root] per butterfly -- the wing gradient runs bright at the tip into
// the deeper shade at the body. Cycled in order rather than picked at random
// so a swarm always reads as one deliberate colourway instead of confetti.
export const WING_PAIRS: [string, string][] = [
  [MONARCH.cyan, MONARCH.violet],
  [MONARCH.rose, MONARCH.blush],
  [MONARCH.amber, MONARCH.coral],
  [MONARCH.mint, MONARCH.cyan],
  [MONARCH.violet, MONARCH.indigo],
];

type MonarchConfig = {
  butterflyCount: number;
  pollenCount: number;
  glowOpacity: number;
  rayOpacity: number;
  sweepOpacity: number;
  borderOpacity: number;
  showRays: boolean;
};

// rayOpacity is deliberately the lowest number in each row -- the rays are
// the one layer that spans the whole card, so they read far stronger than
// their alpha suggests and have to stay near-invisible to work as haze.
export const MONARCH_INTENSITY: Record<MonarchIntensity, MonarchConfig> = {
  subtle:   { butterflyCount: 3, pollenCount: 10, glowOpacity: 0.50, rayOpacity: 0.05, sweepOpacity: 0.12, borderOpacity: 0.50, showRays: true },
  balanced: { butterflyCount: 5, pollenCount: 16, glowOpacity: 0.75, rayOpacity: 0.08, sweepOpacity: 0.20, borderOpacity: 0.70, showRays: true },
  vivid:    { butterflyCount: 7, pollenCount: 22, glowOpacity: 0.95, rayOpacity: 0.12, sweepOpacity: 0.28, borderOpacity: 0.90, showRays: true },
};

// Applied on top of the chosen intensity for weaker devices. Butterflies are
// the expensive layer here -- each one is two SVGs plus its own flap and
// travel driver -- so that's what gets cut first, along with the rays.
export const LOW_PERFORMANCE_OVERRIDE: Partial<MonarchConfig> = {
  butterflyCount: 3,
  pollenCount: 6,
  showRays: false,
};

export function resolveMonarchConfig(intensity: MonarchIntensity, lowPerformance?: boolean): MonarchConfig {
  const base = MONARCH_INTENSITY[intensity];
  return lowPerformance ? { ...base, ...LOW_PERFORMANCE_OVERRIDE } : base;
}
