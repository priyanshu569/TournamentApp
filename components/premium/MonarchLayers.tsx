import { useMemo } from 'react';
import { View, StyleSheet, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle, SharedValue, withRepeat, withSequence, withDelay, withTiming, Easing, interpolateColor,
} from 'react-native-reanimated';
import SoftOrb from './SoftOrb';
import Butterfly from './Butterfly';
import { useLoopValue } from './useAnimationGate';
import { MONARCH, WING_PAIRS } from './monarchTokens';
import { seededRandom } from './premiumTokens';

// ============================================================
// Layer 1 -- Meadow glow.
// Big, slow pools of colour that give the card depth before anything else
// lands on it. Each has its own duration and travel vector so they drift
// apart and back together rather than sliding as one sheet.
// ============================================================

const GLOWS = [
  { size: 250, color: MONARCH.magenta, left: '-20%', top: '-28%', dx: 64, dy: 42, dur: 18000, alpha: 0.55, core: 0.44 },
  { size: 205, color: MONARCH.rose,    left: '60%',  top: '22%',  dx: -58, dy: -46, dur: 23000, alpha: 0.40, core: 0.40 },
  { size: 175, color: MONARCH.coral,   left: '26%',  top: '56%',  dx: 46, dy: -38, dur: 15000, alpha: 0.38, core: 0.48 },
];

export function MeadowGlow({ active, opacity }: { active: boolean; opacity: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {GLOWS.map((g, i) => (
        <DriftingGlow key={i} {...g} active={active} layerOpacity={opacity} />
      ))}
    </View>
  );
}

function DriftingGlow({
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
      { scale: 0.9 + t.value * 0.26 },
    ],
  }));

  return (
    <Animated.View
      style={[style, { position: 'absolute', left: left as DimensionValue, top: top as DimensionValue, opacity: layerOpacity }]}
      pointerEvents="none"
    >
      <SoftOrb size={size} color={color} opacity={alpha} core={core} />
    </Animated.View>
  );
}

// ============================================================
// Layer 2 -- Pollen.
// Warm motes hanging in the air. Cost control lives here: 4 shared drivers
// animate every mote, each reading its driver through its own phase offset,
// so no two peak together while per-frame work stays flat regardless of count.
// ============================================================

const POLLEN_DURATIONS = [3200, 4100, 5200, 6400];

export function PollenField({ active, count }: { active: boolean; count: number }) {
  const motes = useMemo(() => {
    const rand = seededRandom(5521);
    return Array.from({ length: count }, () => ({
      left: `${rand() * 96}%` as DimensionValue,
      top: `${rand() * 90}%` as DimensionValue,
      size: rand() < 0.7 ? 2 : 3.2,
      phase: rand(),
      base: 0.12 + rand() * 0.16,
      amp: 0.38 + rand() * 0.5,
      driftY: 12 + rand() * 22,
      driftX: 5 + rand() * 12,
    }));
  }, [count]);

  // Hooks can't be called in a loop, so the four drivers are declared flat.
  const d0 = useLoopValue(active, 0, () => withRepeat(withTiming(1, { duration: POLLEN_DURATIONS[0], easing: Easing.inOut(Easing.sin) }), -1, true));
  const d1 = useLoopValue(active, 0, () => withRepeat(withTiming(1, { duration: POLLEN_DURATIONS[1], easing: Easing.inOut(Easing.sin) }), -1, true));
  const d2 = useLoopValue(active, 0, () => withRepeat(withTiming(1, { duration: POLLEN_DURATIONS[2], easing: Easing.inOut(Easing.sin) }), -1, true));
  const d3 = useLoopValue(active, 0, () => withRepeat(withTiming(1, { duration: POLLEN_DURATIONS[3], easing: Easing.inOut(Easing.sin) }), -1, true));
  const drivers = [d0, d1, d2, d3];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {motes.map((m, i) => (
        <Mote key={i} {...m} driver={drivers[i % drivers.length]} />
      ))}
    </View>
  );
}

function Mote({
  left, top, size, phase, base, amp, driftY, driftX, driver,
}: {
  left: DimensionValue; top: DimensionValue; size: number;
  phase: number; base: number; amp: number; driftY: number; driftX: number;
  driver: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const p = (driver.value + phase) * Math.PI * 2;
    const wave = 0.5 + 0.5 * Math.sin(p);
    return {
      opacity: base + wave * amp,
      transform: [
        { translateY: -wave * driftY },
        // Offset phase so horizontal sway never lines up with the rise,
        // which is what makes it read as floating rather than bouncing.
        { translateX: Math.sin(p + 1.7) * driftX },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        style,
        { position: 'absolute', left, top, width: size, height: size, borderRadius: size / 2, backgroundColor: MONARCH.pollen },
      ]}
    />
  );
}

// ============================================================
// Layer 3 -- Light rays.
// Two shafts angled through the card, breathing very slowly. Kept far below
// the wings in brightness: they're atmosphere, not a light source.
//
// Built from the radial SoftOrb rather than a LinearGradient band. A band
// can only fade along one axis, which left the shafts with hard vertical
// cuts down both sides; squeezing a radial orb into an ellipse instead
// gives falloff in every direction, so the shaft has no edge at all.
// ============================================================

const RAYS = [
  { cx: 0.22, angle: '16deg', dur: 7000, delay: 0, narrow: 0.20, long: 2.4, alpha: 0.55 },
  { cx: 0.68, angle: '11deg', dur: 9000, delay: 2200, narrow: 0.15, long: 2.2, alpha: 0.42 },
];

export function LightRays({
  active, opacity, width, height,
}: { active: boolean; opacity: number; width: number; height: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {RAYS.map((r, i) => (
        <Ray key={i} {...r} active={active} layerOpacity={opacity} width={width} height={height} />
      ))}
    </View>
  );
}

function Ray({
  cx, angle, dur, delay, narrow, long, alpha, active, layerOpacity, width, height,
}: {
  cx: number; angle: string; dur: number; delay: number;
  narrow: number; long: number; alpha: number;
  active: boolean; layerOpacity: number; width: number; height: number;
}) {
  const t = useLoopValue(active, 0, () =>
    withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true)),
  );

  // Transforms are applied right-to-left, so this is: stretch tall, squeeze
  // thin, then tilt -- i.e. build the shaft, then angle it.
  const style = useAnimatedStyle(() => ({
    opacity: layerOpacity * (0.4 + t.value * 0.6),
    transform: [{ rotate: angle }, { scaleX: narrow }, { scaleY: long + t.value * 0.25 }],
  }));

  // Pre-scale diameter. Once stretched by `long` it comfortably overshoots
  // the card, so the soft ends stay outside the clip.
  const size = Math.max(120, height);

  return (
    <Animated.View
      style={[
        style,
        { position: 'absolute', left: cx * width - size / 2, top: height / 2 - size / 2 },
      ]}
      pointerEvents="none"
    >
      {/* High `core` flattens the falloff into a haze rather than a hot
          centre with a visible bright spot. */}
      <SoftOrb size={size} color={MONARCH.ray} opacity={alpha} core={0.6} />
    </Animated.View>
  );
}

// ============================================================
// Layer 4 -- The swarm. The reason this theme exists.
// Each butterfly owns two drivers: a fast flap and a slow traversal. Flight
// is a straight drift with a sine flutter laid over it and a bank angle
// derived from that same wave, so the tilt always agrees with which way it's
// actually moving.
// ============================================================

export function ButterflySwarm({
  active, count, width, height,
}: { active: boolean; count: number; width: number; height: number }) {
  const specs = useMemo(() => {
    const rand = seededRandom(2718);
    return Array.from({ length: count }, (_, i) => ({
      size: 20 + Math.round(rand() * 15),
      colors: WING_PAIRS[i % WING_PAIRS.length],
      startY: 0.1 + rand() * 0.62,
      // Net vertical drift across the pass, as a fraction of card height.
      rise: -0.26 + rand() * 0.2,
      bob: 9 + rand() * 17,
      loops: 2 + Math.round(rand() * 3),
      dur: 15000 + Math.round(rand() * 12000),
      delay: Math.round(rand() * 9000),
      flapMs: 250 + Math.round(rand() * 180),
      // A third of them cross the other way so the swarm doesn't look like
      // it's all being blown by the same wind.
      dir: rand() < 0.34 ? -1 : 1,
    }));
  }, [count]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {specs.map((s, i) => (
        <FlyingButterfly key={i} spec={s} width={width} height={height} active={active} />
      ))}
    </View>
  );
}

type Spec = {
  size: number; colors: [string, string]; startY: number; rise: number;
  bob: number; loops: number; dur: number; delay: number; flapMs: number; dir: number;
};

function FlyingButterfly({
  spec, width, height, active,
}: { spec: Spec; width: number; height: number; active: boolean }) {
  const travel = useLoopValue(active, 0, () =>
    withDelay(spec.delay, withRepeat(withTiming(1, { duration: spec.dur, easing: Easing.linear }), -1)),
  );

  const flap = useLoopValue(active, 1, () =>
    withRepeat(withTiming(0.42, { duration: spec.flapMs, easing: Easing.inOut(Easing.quad) }), -1, true),
  );

  // Full travel including a butterfly-width of clearance at each end, so it
  // enters and leaves fully off-card rather than materialising at the edge.
  const span = width + spec.size * 2;

  const style = useAnimatedStyle(() => {
    const t = travel.value;
    const x = spec.dir > 0 ? -spec.size + t * span : width + spec.size - t * span;
    const wave = t * spec.loops * Math.PI * 2;
    const y = height * spec.startY + t * height * spec.rise + Math.sin(wave) * spec.bob;
    // cos is the slope of the sine above -- banking straight out of the
    // flight path instead of an unrelated wobble.
    const tilt = Math.cos(wave) * 14 * spec.dir;
    // Fade across the first and last tenth of the pass.
    const fade = Math.max(0, Math.min(1, Math.min(t, 1 - t) / 0.1));

    return {
      opacity: fade,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${tilt}deg` }],
    };
  });

  // Halo brightens as the wings open, so each beat reads as the butterfly
  // catching the light rather than just changing shape.
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + flap.value * 0.38,
  }));

  const glowSize = spec.size * 1.9;
  const glowOffset = (glowSize - spec.size) / 2;

  return (
    <Animated.View style={[style, { position: 'absolute', left: 0, top: 0 }]} pointerEvents="none">
      <View style={{ width: spec.size, height: spec.size }}>
        <Animated.View style={[glowStyle, { position: 'absolute', left: -glowOffset, top: -glowOffset }]}>
          <SoftOrb size={glowSize} color={spec.colors[0]} opacity={0.42} core={0.3} />
        </Animated.View>
        <Butterfly size={spec.size} colors={spec.colors} flap={flap} />
      </View>
    </Animated.View>
  );
}

// ============================================================
// Layer 5 -- Iridescent sweep.
// One diagonal shimmer roughly every 11s, tinted rather than white so it
// reads as light catching wing-scales instead of a glass reflection.
// ============================================================

export function IridescentSweep({
  active, opacity, width, height,
}: { active: boolean; opacity: number; width: number; height: number }) {
  const t = useLoopValue(active, 0, () =>
    withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(4200, withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) })),
        withDelay(1400, withTiming(1, { duration: 0 })),
      ),
      -1,
    ),
  );

  const band = Math.max(56, width * 0.34);
  // Long enough that the band still spans the card once rotated 45deg.
  const span = (width + height) * 1.3;

  const style = useAnimatedStyle(() => ({
    opacity: Math.sin(t.value * Math.PI) * opacity,
    transform: [
      { translateX: -width * 0.7 + t.value * width * 1.6 },
      { translateY: -height * 0.7 + t.value * height * 1.6 },
      { rotate: '45deg' },
    ],
  }));

  return (
    <Animated.View
      style={[style, { position: 'absolute', left: (width - band) / 2, top: (height - span) / 2, width: band, height: span }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['transparent', `${MONARCH.rose}66`, `${MONARCH.gold}55`, 'transparent']}
        locations={[0, 0.42, 0.62, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ============================================================
// Border -- cycles rose -> coral -> gold, the swarm's own colours, so the
// card's edge always belongs to whatever is flying inside it.
// ============================================================

export function MonarchBorder({
  active, opacity, borderRadius,
}: { active: boolean; opacity: number; borderRadius: number }) {
  const t = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  const style = useAnimatedStyle(() => ({
    borderColor: interpolateColor(t.value, [0, 0.5, 1], [MONARCH.rose, MONARCH.coral, MONARCH.gold]),
    opacity: opacity * (0.45 + t.value * 0.55),
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style, { borderRadius, borderWidth: 1 }]}
      pointerEvents="none"
    />
  );
}
