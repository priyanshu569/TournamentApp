import { useMemo } from 'react';
import { View, StyleSheet, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle, SharedValue, withRepeat, withSequence, withDelay, withTiming, Easing, interpolateColor,
} from 'react-native-reanimated';
import SoftOrb from './SoftOrb';
import { useLoopValue } from './useAnimationGate';
import { NEBULA, seededRandom } from './premiumTokens';

type LayerProps = { active: boolean; opacity: number };

// ============================================================
// Layer 1 -- Gradient drift.
// A wide purple/blue wash oversized to 1.4x so its edges never enter frame,
// panning over ~38s. Deliberately slow enough that it reads as "alive"
// rather than as movement you can actually follow.
// ============================================================

export function GradientDrift({ active, opacity }: LayerProps) {
  const t = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: 15000, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: -55 + t.value * 110 },
      { translateY: -30 + t.value * 60 },
      { scale: 1.45 },
    ],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style, { opacity }]} pointerEvents="none">
      <LinearGradient
        colors={['transparent', `${NEBULA.purple}55`, `${NEBULA.blue}2E`, 'transparent']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ============================================================
// Layer 5 -- Nebula clouds.
// The depth foundation: large, saturated, extremely slow. Each cloud has its
// own duration and travel vector so they drift apart and back together
// instead of sliding as one sheet.
// ============================================================

const CLOUDS = [
  { size: 260, color: NEBULA.purple, left: '-18%', top: '-30%', dx: 70, dy: 46, dur: 19000, alpha: 0.60, core: 0.42 },
  { size: 210, color: NEBULA.blue,   left: '58%',  top: '18%',  dx: -62, dy: -52, dur: 24000, alpha: 0.40, core: 0.38 },
  { size: 180, color: NEBULA.royal,  left: '22%',  top: '52%',  dx: 50, dy: -40, dur: 16000, alpha: 0.65, core: 0.5 },
];

export function NebulaClouds({ active, opacity }: LayerProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {CLOUDS.map((c, i) => (
        <DriftingOrb key={i} {...c} active={active} layerOpacity={opacity} />
      ))}
    </View>
  );
}

// ============================================================
// Layer 2 -- Cosmic fog.
// Broader, paler and less saturated than the clouds, moving on its own
// timing. Sitting between clouds and stars is what creates the "layers of
// glass" separation -- stars read as being *in front of* the fog.
// ============================================================

const FOG = [
  { size: 300, color: NEBULA.violet, left: '-25%', top: '10%',  dx: 92, dy: -34, dur: 14000, alpha: 0.24, core: 0.62 },
  { size: 250, color: NEBULA.cyan,   left: '48%',  top: '-24%', dx: -78, dy: 56, dur: 11000, alpha: 0.18, core: 0.66 },
];

export function CosmicFog({ active, opacity }: LayerProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {FOG.map((f, i) => (
        <DriftingOrb key={i} {...f} active={active} layerOpacity={opacity} />
      ))}
    </View>
  );
}

// Shared mover for clouds and fog: slow positional drift plus a gentle scale
// "breath" so the shapes subtly change form rather than sliding rigidly.
function DriftingOrb({
  size, color, left, top, dx, dy, dur, alpha, core, active, layerOpacity,
}: {
  size: number; color: string; left: string; top: string;
  dx: number; dy: number; dur: number; alpha: number; core: number;
  active: boolean; layerOpacity: number;
}) {
  const t = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: t.value * dx },
      { translateY: t.value * dy },
      { scale: 0.88 + t.value * 0.30 },
    ],
  }));

  return (
    <Animated.View
      style={[
        style,
        { position: 'absolute', left: left as DimensionValue, top: top as DimensionValue, opacity: layerOpacity },
      ]}
      pointerEvents="none"
    >
      <SoftOrb size={size} color={color} opacity={alpha} core={core} />
    </Animated.View>
  );
}

// ============================================================
// Layer 3 -- Stars.
// Cost control lives here: 4 shared drivers animate every star. Each star
// reads its driver through its own phase offset, so no two peak together
// while the per-frame work stays flat regardless of star count.
// ============================================================

const STAR_GROUP_DURATIONS = [1500, 2100, 2800, 3500];

export function StarField({ active, count }: { active: boolean; count: number }) {
  const stars = useMemo(() => {
    const rand = seededRandom(9137);
    return Array.from({ length: count }, () => ({
      left: `${rand() * 96}%` as DimensionValue,
      top: `${rand() * 92}%` as DimensionValue,
      size: rand() < 0.72 ? 1.8 : 3,
      phase: rand(),
      // Low floor + high swing gives each star real contrast between its dim
      // and bright states -- a narrow band just reads as a static dot.
      base: 0.1 + rand() * 0.16,
      amp: 0.42 + rand() * 0.55,
    }));
  }, [count]);

  // Hooks can't be called in a loop, so the four drivers are declared flat.
  const d0 = useLoopValue(active, 0, () => withRepeat(withTiming(1, { duration: STAR_GROUP_DURATIONS[0], easing: Easing.inOut(Easing.sin) }), -1, true));
  const d1 = useLoopValue(active, 0, () => withRepeat(withTiming(1, { duration: STAR_GROUP_DURATIONS[1], easing: Easing.inOut(Easing.sin) }), -1, true));
  const d2 = useLoopValue(active, 0, () => withRepeat(withTiming(1, { duration: STAR_GROUP_DURATIONS[2], easing: Easing.inOut(Easing.sin) }), -1, true));
  const d3 = useLoopValue(active, 0, () => withRepeat(withTiming(1, { duration: STAR_GROUP_DURATIONS[3], easing: Easing.inOut(Easing.sin) }), -1, true));
  const drivers = [d0, d1, d2, d3];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((s, i) => (
        <Star key={i} {...s} driver={drivers[i % drivers.length]} />
      ))}
    </View>
  );
}

function Star({
  left, top, size, phase, base, amp, driver,
}: {
  left: DimensionValue; top: DimensionValue; size: number;
  phase: number; base: number; amp: number; driver: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    // Phase-shifted sine keeps each star on its own schedule even though it
    // shares a driver with a quarter of the field.
    const wave = 0.5 + 0.5 * Math.sin((driver.value + phase) * Math.PI * 2);
    return { opacity: base + wave * amp };
  });

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute', left, top,
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: NEBULA.star,
        },
      ]}
    />
  );
}

// ============================================================
// Layer 4 -- Glow particles.
// Only a handful, each with its own size, colour, opacity, path and speed.
// Rendered as soft orbs rather than flat dots so they glow instead of
// looking like specks of dust.
// ============================================================

export function GlowParticles({ active, count }: { active: boolean; count: number }) {
  const particles = useMemo(() => {
    const rand = seededRandom(4421);
    const palette = [NEBULA.blue, NEBULA.purple, NEBULA.cyan, NEBULA.violet];
    return Array.from({ length: count }, (_, i) => ({
      size: 14 + Math.round(rand() * 16),
      color: palette[i % palette.length],
      left: `${4 + rand() * 84}%` as DimensionValue,
      top: `${6 + rand() * 78}%` as DimensionValue,
      dx: -46 + rand() * 92,
      dy: -54 + rand() * 76,
      dur: 5000 + Math.round(rand() * 6000),
      alpha: 0.34 + rand() * 0.4,
    }));
  }, [count]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <GlowParticle key={i} {...p} active={active} />
      ))}
    </View>
  );
}

function GlowParticle({
  size, color, left, top, dx, dy, dur, alpha, active,
}: {
  size: number; color: string; left: DimensionValue; top: DimensionValue;
  dx: number; dy: number; dur: number; alpha: number; active: boolean;
}) {
  const t = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + t.value * 0.65,
    transform: [
      { translateX: t.value * dx },
      { translateY: t.value * dy },
      { scale: 0.8 + t.value * 0.4 },
    ],
  }));

  return (
    <Animated.View style={[style, { position: 'absolute', left, top }]} pointerEvents="none">
      <SoftOrb size={size} color={color} opacity={alpha} core={0.35} />
    </Animated.View>
  );
}

// ============================================================
// Layer 6 -- Light sweep.
// A single diagonal reflection roughly every 10s. Peak opacity is very low by
// design: it should register as a passing highlight, not a flash.
// ============================================================

export function LightSweep({ active, opacity, width, height }: LayerProps & { width: number; height: number }) {
  const t = useLoopValue(active, 0, () =>
    withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(3400, withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) })),
        withDelay(1200, withTiming(1, { duration: 0 })),
      ),
      -1,
    ),
  );

  const band = Math.max(50, width * 0.3);
  // Long enough that the band still spans the card once rotated 45deg.
  const span = (width + height) * 1.3;

  const style = useAnimatedStyle(() => ({
    // Fades in and out across its own travel so it never pops at the edges.
    opacity: Math.sin(t.value * Math.PI) * opacity,
    transform: [
      { translateX: -width * 0.7 + t.value * width * 1.6 },
      { translateY: -height * 0.7 + t.value * height * 1.6 },
      { rotate: '45deg' },
    ],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          left: (width - band) / 2,
          top: (height - span) / 2,
          width: band,
          height: span,
        },
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['transparent', '#FFFFFF', '#DCEBFF', 'transparent']}
        locations={[0, 0.45, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ============================================================
// Border -- a slow purple <-> blue outline whose intensity breathes.
// Sits above every layer so the card always has a crisp premium edge.
// ============================================================

export function BorderGlow({ active, opacity, borderRadius }: LayerProps & { borderRadius: number }) {
  const t = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  const style = useAnimatedStyle(() => ({
    borderColor: interpolateColor(t.value, [0, 1], [NEBULA.purple, NEBULA.cyan]),
    opacity: opacity * (0.4 + t.value * 0.6),
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style, { borderRadius, borderWidth: 1 }]}
      pointerEvents="none"
    />
  );
}
