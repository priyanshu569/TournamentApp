import { useMemo } from 'react';
import { View, StyleSheet, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle, SharedValue, withRepeat, withSequence, withDelay, withTiming, Easing,
} from 'react-native-reanimated';
import SoftOrb from './SoftOrb';
import { Flame, ObsidianCracks, DragonFace, FACE_EYES, FACE_ASPECT, DragonWing, DragonTail, DragonScales, DragonSilhouette } from './DragonShapes';
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

export function LavaFlow({ active, roar, width, height, crackGlow }: Base & { width: number; height: number; crackGlow: number }) {
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

  const crackStyle = useAnimatedStyle(() => ({
    opacity: crackGlow * (0.55 + 0.25 * flowA.value + roar.value * 0.5),
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

      {/* Obsidian shell: darkens everything back down so the lava only shows
          through the cracks rather than washing the whole card orange. */}
      <LinearGradient
        colors={[`${DRAGON.obsidian}E6`, `${DRAGON.ash}C4`, `${DRAGON.obsidian}F2`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[StyleSheet.absoluteFill, crackStyle]}>
        <ObsidianCracks width={width} height={height} />
      </Animated.View>
    </View>
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
// The dragon.
// Never fully shown. Parts surface on long, mutually-offset cycles so the
// viewer assembles one enormous creature from glimpses instead of ever
// seeing it whole. Sits BENEATH smoke in the stack, which is what makes it
// read as being behind the world rather than pasted on top.
// ============================================================

export function DragonPresence({ active, eyes, width, height }: { active: boolean; eyes: SharedValue<number>; width: number; height: number }) {
  // Sized to fit the card without cropping the horns, then centred. This is a
  // permanent backdrop rather than a timed reveal -- the face is the world the
  // banner sits in, and only its eyes come and go.
  const faceWidth = Math.min(width * 0.68, height * 1.15);
  const faceHeight = faceWidth * FACE_ASPECT;
  const faceLeft = (width - faceWidth) / 2;
  const faceTop = (height - faceHeight) / 2;

  const loom = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  // Kept deliberately dim: the face should be something you notice on the
  // second look, not a portrait competing with the avatar.
  const faceStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + loom.value * 0.14,
    transform: [{ scale: 0.99 + loom.value * 0.03 }],
  }));

  const eyeGlowStyle = useAnimatedStyle(() => ({
    opacity: eyes.value,
    transform: [{ scale: 0.8 + eyes.value * 0.5 }],
  }));

  const glowSize = faceWidth * 0.22;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[faceStyle, { position: 'absolute', left: faceLeft, top: faceTop }]}
        pointerEvents="none"
      >
        <DragonFace width={faceWidth} />
      </Animated.View>

      {/* Sockets light up on the shared `eyes` beat. Positioned from the
          face's own eye fractions so they stay aligned at any size. */}
      {FACE_EYES.map((e, i) => (
        <Animated.View
          key={i}
          style={[
            eyeGlowStyle,
            {
              position: 'absolute',
              left: faceLeft + faceWidth * e.x - glowSize / 2,
              top: faceTop + faceHeight * e.y - glowSize / 2,
            },
          ]}
          pointerEvents="none"
        >
          <SoftOrb size={glowSize} color={DRAGON.lava} opacity={0.95} core={0.3} />
        </Animated.View>
      ))}

      <RevealedPart active={active} delay={11000} hold={2600} gap={21000} peak={0.42}
        style={{ position: 'absolute', right: '-14%', top: '2%' }}>
        <DragonWing width={width * 0.62} />
      </RevealedPart>

      <RevealedPart active={active} delay={17000} hold={2200} gap={17000} peak={0.4}
        style={{ position: 'absolute', left: '-10%', bottom: '4%' }}>
        <DragonTail width={width * 0.58} />
      </RevealedPart>

      <RevealedPart active={active} delay={7000} hold={3000} gap={23000} peak={0.3}
        style={{ position: 'absolute', right: '4%', bottom: '18%' }}>
        <DragonScales width={width * 0.34} />
      </RevealedPart>
    </View>
  );
}

function RevealedPart({
  active, delay, hold, gap, peak, style, children,
}: {
  active: boolean; delay: number; hold: number; gap: number; peak: number;
  style: object; children: React.ReactNode;
}) {
  const t = useLoopValue(active, 0, () =>
    withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }),
          withDelay(hold, withTiming(0, { duration: 2200, easing: Easing.in(Easing.cubic) })),
          withDelay(gap, withTiming(0, { duration: 0 })),
        ),
        -1,
      ),
    ),
  );

  const anim = useAnimatedStyle(() => ({
    opacity: t.value * peak,
    transform: [{ scale: 0.97 + t.value * 0.05 }],
  }));

  return <Animated.View style={[style, anim]} pointerEvents="none">{children}</Animated.View>;
}

// The roar: silhouette surfaces, everything blooms. Driven entirely by the
// shared `roar` value so all layers spike on exactly the same frame.
export function RoarFlash({ roar, width, peak }: { roar: SharedValue<number>; width: number; peak: number }) {
  const bloomStyle = useAnimatedStyle(() => ({ opacity: roar.value * 0.38 * peak }));

  const silStyle = useAnimatedStyle(() => ({
    opacity: roar.value * 0.62 * peak,
    transform: [{ scale: 1.02 + roar.value * 0.08 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', left: '4%', top: '8%' }, silStyle]}>
        <DragonSilhouette width={width * 0.92} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, bloomStyle, { backgroundColor: DRAGON.molten }]} />
    </View>
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
