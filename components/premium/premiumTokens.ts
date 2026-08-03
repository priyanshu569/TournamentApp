// Design tokens for premium (subscription-only) profile banners.
// Kept separate from components so a future premium theme can be added by
// defining a new palette + intensity table without touching the layer engine.

export type Intensity = 'subtle' | 'balanced' | 'vivid';

export const NEBULA = {
  // Background is "almost black" with a faint violet bias rather than pure
  // #000 -- pure black kills the sense of depth once fog sits on top of it.
  base: ['#07060F', '#0C0A1B', '#050409'] as [string, string, ...string[]],
  purple: '#6C3EFF',
  violet: '#8B5CF6',
  royal: '#4C1D95',
  blue: '#4DB7FF',
  cyan: '#7FE6FF',
  star: '#EAF2FF',
};

type IntensityConfig = {
  starCount: number;
  particleCount: number;
  cloudOpacity: number;
  fogOpacity: number;
  driftOpacity: number;
  sweepOpacity: number;
  borderOpacity: number;
};

// Scales density and brightness together. Lower tiers are also the cheap
// fallback for low-end devices, not just an aesthetic preference.
export const INTENSITY: Record<Intensity, IntensityConfig> = {
  subtle:   { starCount: 14, particleCount: 4, cloudOpacity: 0.50, fogOpacity: 0.40, driftOpacity: 0.18, sweepOpacity: 0.05, borderOpacity: 0.35 },
  balanced: { starCount: 22, particleCount: 6, cloudOpacity: 0.75, fogOpacity: 0.60, driftOpacity: 0.26, sweepOpacity: 0.08, borderOpacity: 0.55 },
  vivid:    { starCount: 30, particleCount: 8, cloudOpacity: 1.00, fogOpacity: 0.80, driftOpacity: 0.34, sweepOpacity: 0.11, borderOpacity: 0.75 },
};

// Deterministic PRNG so star/particle layouts are stable across re-renders
// (a fresh Math.random() on every render would visibly reshuffle the sky).
export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
