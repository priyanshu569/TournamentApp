// Palette + density presets for the "Monarch" butterfly banner.
// Split from the components so the layer engine stays theme-agnostic --
// same split as premiumTokens.ts (Nebula) and dragonTokens.ts.

export type MonarchIntensity = 'subtle' | 'balanced' | 'vivid';

export const MONARCH = {
  // A rose-twilight garden: deep wine shading through plum. Never pure black
  // -- the wings are the brightest thing on this card and need a surface with
  // some colour in it to sit against, or they read as stickers.
  //
  // Kept dark on purpose despite being a warm palette: the swarm includes
  // rose and amber butterflies, and a lighter pink ground swallows them.
  base: ['#12040E', '#2B0A24', '#160512'] as [string, string, ...string[]],
  // Every accent lives on the magenta -> gold arc. Nothing cool anywhere:
  // one stray cyan reads as a different scene bleeding in.
  magenta: '#D946EF',
  pink: '#FF9ECF',
  rose: '#FF6FD8',
  blush: '#FF4D8D',
  crimson: '#E0245E',
  coral: '#FF7A5C',
  ember: '#FFA05C',
  amber: '#FFC46B',
  gold: '#FFD98A',
  peach: '#FFB4A2',
  pollen: '#FFE9B0',
  // A pink-white, so the shafts read as light in *this* garden.
  ray: '#FFE9F5',
  body: '#1B0A18',
};

// [tip, root] per butterfly -- the wing gradient runs bright at the tip into
// the deeper shade at the body. Cycled in order rather than picked at random
// so a swarm always reads as one deliberate colourway instead of confetti.
//
// All warm, but spread wide across the arc (hot pink through to gold) and
// kept bright: on a deep wine ground the swarm separates on brightness, not
// on hue, so value contrast is what has to be protected here.
export const WING_PAIRS: [string, string][] = [
  [MONARCH.pink, MONARCH.magenta],
  [MONARCH.amber, MONARCH.coral],
  [MONARCH.rose, MONARCH.blush],
  [MONARCH.gold, MONARCH.ember],
  [MONARCH.peach, MONARCH.crimson],
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
