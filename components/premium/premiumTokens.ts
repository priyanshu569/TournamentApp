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
  subtle:   { starCount: 16, particleCount: 5, cloudOpacity: 0.65, fogOpacity: 0.50, driftOpacity: 0.26, sweepOpacity: 0.13, borderOpacity: 0.50 },
  balanced: { starCount: 26, particleCount: 7, cloudOpacity: 0.90, fogOpacity: 0.72, driftOpacity: 0.38, sweepOpacity: 0.22, borderOpacity: 0.70 },
  vivid:    { starCount: 34, particleCount: 9, cloudOpacity: 1.00, fogOpacity: 0.90, driftOpacity: 0.50, sweepOpacity: 0.30, borderOpacity: 0.90 },
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
