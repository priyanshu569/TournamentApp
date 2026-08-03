import { useMemo } from 'react';
import { View, StyleSheet, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle, SharedValue, withRepeat, withSequence, withDelay, withTiming, Easing,
} from 'react-native-reanimated';
import SoftOrb from './SoftOrb';
import { Flame } from './DragonShapes';
import { useLoopValue } from './useAnimationGate';
import { DRAGON } from './dragonTokens';
import { seededRandom as seededDragonRandom } from './premiumTokens';

type Base = { active: boolean; roar: SharedValue<number> };

// ============================================================
// Layer 1 -- Molten lava beneath cracked obsidian.
// Two counter-drifting gradient sheets read as flow; the crack network sits
// on top, and its glow brightens with the roar so the ground looks like it
// is being lit from below rather than tinted.
// ============================================================

export function LavaFlow({ active, roar }: Base) {
  const flowA = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: 17000, easing: Easing.inOut(Easing.sin) }), -1, true),
  );
  const flowB = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: 23000, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  const sheetA = useAnimatedStyle(() => ({
    opacity: 0.5 + flowA.value * 0.3 + roar.value * 0.25,
    transform: [{ translateX: -40 + flowA.value * 80 }, { translateY: 10 - flowA.value * 20 }, { scale: 1.5 }],
  }));

  const sheetB = useAnimatedStyle(() => ({
    opacity: 0.35 + flowB.value * 0.35 + roar.value * 0.2,
    transform: [{ translateX: 50 - flowB.value * 100 }, { translateY: -14 + flowB.value * 28 }, { scale: 1.6 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, sheetA]}>
        <LinearGradient
          colors={[DRAGON.deepRed, DRAGON.molten, DRAGON.crimson, 'transparent']}
          locations={[0, 0.35, 0.7, 1]}
          start={{ x: 0.1, y: 1 }}
          end={{ x: 0.9, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, sheetB]}>
        <LinearGradient
          colors={['transparent', DRAGON.burnt, DRAGON.deepRed, 'transparent']}
          locations={[0, 0.3, 0.65, 1]}
          start={{ x: 0.9, y: 1 }}
          end={{ x: 0.2, y: 0.1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Obsidian shell: darkens everything back down so the lava reads as
          glowing beneath rock rather than washing the whole card orange. */}
      <LinearGradient
        colors={[`${DRAGON.obsidian}E6`, `${DRAGON.ash}C4`, `${DRAGON.obsidian}F2`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

// ============================================================
// Base fire -- a solid glow hugging the bottom edge, so the card reads as
// standing over a floor of fire rather than only having flame tongues
// scattered across it.
// ============================================================

export function BaseFireGlow({ active, height }: { active: boolean; height: number }) {
  const t = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  const bandHeight = Math.max(46, height * 0.4);

  const style = useAnimatedStyle(() => ({
    opacity: 0.55 + t.value * 0.35,
    transform: [{ scaleY: 0.9 + t.value * 0.25 }],
  }));

  return (
    <Animated.View
      style={[
        style,
        { position: 'absolute', left: 0, right: 0, bottom: 0, height: bandHeight, transformOrigin: 'bottom' },
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[DRAGON.emberCore, DRAGON.molten, DRAGON.deepRed, 'transparent']}
        locations={[0, 0.25, 0.6, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ============================================================
// Layer 2 -- Fire. Independent tongues with their own height, sway and
// flicker so the fire line never pulses as one unit.
// ============================================================

export function FlameField({ active, roar, count, opacity, width }: Base & { count: number; opacity: number; width: number }) {
  const flames = useMemo(() => {
    const rand = seededDragonRandom(7714);
    return Array.from({ length: count }, (_, i) => ({
      left: (i / count) * 100 + rand() * 6 - 3,
      w: 26 + rand() * 26,
      h: 42 + rand() * 54,
      dur: 900 + rand() * 1100,
      delay: rand() * 1400,
      sway: 3 + rand() * 7,
      alpha: 0.5 + rand() * 0.5,
    }));
  }, [count]);

  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]} pointerEvents="none">
      {flames.map((f, i) => (
        <FlameTongue key={i} {...f} active={active} roar={roar} layerOpacity={opacity} bannerWidth={width} />
      ))}
    </View>
  );
}

function FlameTongue({
  left, w, h, dur, delay, sway, alpha, active, roar, layerOpacity, bannerWidth,
}: {
  left: number; w: number; h: number; dur: number; delay: number; sway: number; alpha: number;
  active: boolean; roar: SharedValue<number>; layerOpacity: number; bannerWidth: number;
}) {
  const t = useLoopValue(active, 0, () =>
    withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.quad) }), -1, true)),
  );

  const style = useAnimatedStyle(() => ({
    opacity: layerOpacity * alpha * (0.55 + t.value * 0.45),
    // transformOrigin below pins the base, so scaleY grows the tip upward
    // instead of stretching the flame in both directions.
    transform: [
      { translateX: -sway + t.value * sway * 2 },
      { scaleY: 0.7 + t.value * 0.5 + roar.value * 0.6 },
      { scaleX: 0.9 + t.value * 0.2 },
    ],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute', bottom: -6,
          left: (left / 100) * bannerWidth,
          transformOrigin: 'bottom',
        },
      ]}
      pointerEvents="none"
    >
      <Flame width={w} height={h} />
    </Animated.View>
  );
}

// ============================================================
// Layer 3 -- Heat haze.
// HONEST LIMITATION: real heat distortion is a refraction shader (Skia).
// Without it there is nothing to refract, so this approximates the read of
// rising hot air with slow warm bands that stretch and slide. It suggests
// heat; it does not bend what is behind it.
// ============================================================

export function HeatHaze({ active, width }: { active: boolean; width: number }) {
  const bands = useMemo(
    () => [
      { top: '52%', dur: 3100, h: 26, alpha: 0.06 },
      { top: '66%', dur: 4200, h: 34, alpha: 0.05 },
      { top: '80%', dur: 2600, h: 22, alpha: 0.07 },
    ],
    [],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bands.map((b, i) => (
        <HazeBand key={i} {...b} active={active} width={width} />
      ))}
    </View>
  );
}

function HazeBand({ top, dur, h, alpha, active, width }: { top: string; dur: number; h: number; alpha: number; active: boolean; width: number }) {
  const t = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  const style = useAnimatedStyle(() => ({
    opacity: alpha * (0.4 + t.value * 0.6),
    transform: [
      { translateX: -14 + t.value * 28 },
      { scaleY: 0.8 + t.value * 0.5 },
      { scaleX: 1.1 },
    ],
  }));

  return (
    <Animated.View
      style={[style, { position: 'absolute', top: top as DimensionValue, left: 0, width, height: h }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['transparent', `${DRAGON.lava}55`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ============================================================
// Layer 4 -- Burning embers.
// Rise, drift sideways, and fade. A third of them "ignite" mid-flight
// (brighten sharply before dying) instead of fading monotonically.
// ============================================================

export function EmberField({ active, count, height }: { active: boolean; count: number; height: number }) {
  const embers = useMemo(() => {
    const rand = seededDragonRandom(3391);
    const palette = [DRAGON.molten, DRAGON.lava, DRAGON.gold, DRAGON.deepRed];
    return Array.from({ length: count }, (_, i) => ({
      left: `${2 + rand() * 94}%` as DimensionValue,
      size: 5 + rand() * 11,
      color: palette[i % palette.length],
      dur: 3400 + rand() * 4200,
      delay: rand() * 4000,
      drift: -26 + rand() * 52,
      alpha: 0.5 + rand() * 0.5,
      ignites: rand() < 0.34,
    }));
  }, [count]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {embers.map((e, i) => (
        <Ember key={i} {...e} active={active} rise={height + 30} />
      ))}
    </View>
  );
}

function Ember({
  left, size, color, dur, delay, drift, alpha, ignites, active, rise,
}: {
  left: DimensionValue; size: number; color: string; dur: number; delay: number;
  drift: number; alpha: number; ignites: boolean; active: boolean; rise: number;
}) {
  const t = useLoopValue(active, 0, () =>
    withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.out(Easing.quad) }), -1)),
  );

  const style = useAnimatedStyle(() => {
    const v = t.value;
    // Igniting embers flare late (a second brightness peak at ~70% of life)
    // rather than simply dimming out.
    const flare = ignites ? 1 + Math.max(0, 1 - Math.abs(v - 0.7) * 9) * 1.4 : 1;
    const fade = v < 0.12 ? v / 0.12 : v > 0.72 ? Math.max(0, (1 - v) / 0.28) : 1;
    return {
      opacity: Math.min(1, fade * alpha * flare),
      transform: [
        { translateY: 10 - v * rise },
        { translateX: Math.sin(v * Math.PI * 2) * drift },
        { scale: (0.6 + v * 0.5) * (ignites ? flare * 0.6 + 0.4 : 1) },
      ],
    };
  });

  return (
    <Animated.View style={[style, { position: 'absolute', left, bottom: 0 }]} pointerEvents="none">
      <SoftOrb size={size} color={color} opacity={0.95} core={0.3} />
    </Animated.View>
  );
}

// ============================================================
// Layer 5 -- Smoke. Large, dark, slow, and low-contrast so it occludes the
// dragon rather than drawing attention itself.
// ============================================================

export function SmokeVeil({ active, count, opacity }: { active: boolean; count: number; opacity: number }) {
  const puffs = useMemo(() => {
    const rand = seededDragonRandom(5527);
    return Array.from({ length: count }, () => ({
      size: 150 + rand() * 160,
      left: `${-12 + rand() * 90}%` as DimensionValue,
      dur: 12000 + rand() * 9000,
      delay: rand() * 6000,
      drift: -30 + rand() * 60,
      color: rand() < 0.3 ? DRAGON.shadowPurple : DRAGON.smoke,
    }));
  }, [count]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {puffs.map((p, i) => (
        <SmokePuff key={i} {...p} active={active} layerOpacity={opacity} />
      ))}
    </View>
  );
}

function SmokePuff({
  size, left, dur, delay, drift, color, active, layerOpacity,
}: {
  size: number; left: DimensionValue; dur: number; delay: number; drift: number;
  color: string; active: boolean; layerOpacity: number;
}) {
  const t = useLoopValue(active, 0, () =>
    withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1)),
  );

  const style = useAnimatedStyle(() => {
    const fade = t.value < 0.2 ? t.value / 0.2 : t.value > 0.65 ? Math.max(0, (1 - t.value) / 0.35) : 1;
    return {
      opacity: fade * layerOpacity,
      transform: [
        { translateY: 40 - t.value * 130 },
        { translateX: t.value * drift },
        { scale: 0.7 + t.value * 0.7 },
      ],
    };
  });

  return (
    <Animated.View style={[style, { position: 'absolute', left, bottom: -40 }]} pointerEvents="none">
      <SoftOrb size={size} color={color} opacity={0.75} core={0.55} />
    </Animated.View>
  );
}

// ============================================================
// Layer 6 -- Volcanic sparks. Fast, thin, vertical, and rare -- the
// counterpoint to the slow layers. Long random gaps keep them from
// establishing a rhythm.
// ============================================================

export function SparkBursts({ active, count, height }: { active: boolean; count: number; height: number }) {
  const sparks = useMemo(() => {
    const rand = seededDragonRandom(8863);
    return Array.from({ length: count }, () => ({
      left: `${6 + rand() * 88}%` as DimensionValue,
      dur: 620 + rand() * 520,
      gap: 2600 + rand() * 7000,
      delay: rand() * 6000,
      len: 10 + rand() * 16,
      drift: -12 + rand() * 24,
    }));
  }, [count]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {sparks.map((s, i) => (
        <Spark key={i} {...s} active={active} rise={height * 0.9} />
      ))}
    </View>
  );
}

function Spark({
  left, dur, gap, delay, len, drift, active, rise,
}: { left: DimensionValue; dur: number; gap: number; delay: number; len: number; drift: number; active: boolean; rise: number }) {
  const t = useLoopValue(active, 0, () =>
    withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: dur, easing: Easing.out(Easing.cubic) }),
          withDelay(gap, withTiming(1, { duration: 0 })),
        ),
        -1,
      ),
    ),
  );

  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 || t.value >= 1 ? 0 : Math.sin(t.value * Math.PI),
    transform: [
      { translateY: -t.value * rise },
      { translateX: t.value * drift },
      { scaleY: 1 - t.value * 0.5 },
    ],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute', left, bottom: 0,
          width: 2, height: len, borderRadius: 1,
          backgroundColor: DRAGON.emberCore,
        },
      ]}
      pointerEvents="none"
    />
  );
}

// ============================================================
// The roar: the whole volcano surges. Driven entirely by the shared `roar`
// value so every layer -- lava glow, flame height, border colour -- spikes
// on exactly the same frame.
// ============================================================

export function RoarBloom({ roar, peak }: { roar: SharedValue<number>; peak: number }) {
  const bloomStyle = useAnimatedStyle(() => ({ opacity: roar.value * 0.5 * peak }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, bloomStyle, { backgroundColor: DRAGON.molten }]}
      pointerEvents="none"
    />
  );
}

// Dragon breath: fire sweeping horizontally BEHIND the avatar, never at the
// viewer. Short, bright, and gone.
export function DragonBreath({ breath, width, height }: { breath: SharedValue<number>; width: number; height: number }) {
  const bandHeight = Math.max(40, height * 0.42);
  const bandWidth = (width + height) * 1.2;

  // -45deg puts the band's long axis perpendicular to the travel direction,
  // so it sweeps corner to corner instead of skidding along its own length.
  const style = useAnimatedStyle(() => ({
    opacity: Math.sin(breath.value * Math.PI) * 0.85,
    transform: [
      { translateX: -width * 0.6 + breath.value * width * 1.6 },
      { translateY: -height * 0.6 + breath.value * height * 1.6 },
      { rotate: '-45deg' },
      { scaleY: 0.8 + breath.value * 0.5 },
    ],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          left: (width - bandWidth) / 2,
          top: (height - bandHeight) / 2,
          width: bandWidth,
          height: bandHeight,
        },
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['transparent', `${DRAGON.deepRed}AA`, `${DRAGON.molten}DD`, `${DRAGON.gold}88`, 'transparent']}
        locations={[0, 0.25, 0.5, 0.72, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}
