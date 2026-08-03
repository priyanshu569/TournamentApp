import { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle, useSharedValue, SharedValue,
  withRepeat, withSequence, withDelay, withTiming, Easing,
} from 'react-native-reanimated';
import { BannerTheme, BASE_GRADIENTS } from './bannerThemes';
import PremiumNebulaBanner from './premium/PremiumNebulaBanner';
import DragonWrathBanner from './premium/DragonWrathBanner';
import SoftOrb from './premium/SoftOrb';

type Props = {
  theme: BannerTheme | null;
  classicColors: [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export default function AnimatedProfileBanner({ theme, classicColors, style, children }: Props) {
  if (!theme) {
    return (
      <LinearGradient colors={classicColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
        {children}
      </LinearGradient>
    );
  }

  // Premium themes own their whole composition rather than layering onto the
  // shared base gradient below.
  if (theme === 'nebula') {
    return <PremiumNebulaBanner style={style}>{children}</PremiumNebulaBanner>;
  }

  if (theme === 'dragonwrath') {
    return <DragonWrathBanner style={style}>{children}</DragonWrathBanner>;
  }

  return (
    <View style={[style, styles.clip]}>
      <LinearGradient colors={BASE_GRADIENTS[theme]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {theme === 'powersurge' && <PowerSurgeLayer />}
      {theme === 'turbo' && <TurboLayer />}
      {children}
    </View>
  );
}

// ============================================================
// Power Surge -- anime "power level rising" burst: a pulsing core
// with radiating spoke lines and quick electric sparks.
// ============================================================

function PowerSurgeLayer() {
  const pulse = useSharedValue(0.3);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
        withTiming(0.3, { duration: 700, easing: Easing.in(Easing.cubic) }),
      ),
      -1,
    );
  }, []);

  const lineAngles = Array.from({ length: 14 }, (_, i) => i * (360 / 14));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lineAngles.map((angle, i) => (
        <BurstLine key={i} angle={angle} pulse={pulse} color={i % 3 === 0 ? '#2E9BFF' : '#FFE28A'} />
      ))}
      <SparkField colors={['#FFE28A', '#2E9BFF', '#ffffff']} count={7} spread={0.75} />
      <MeteorField />
    </View>
  );
}

// ============================================================
// Meteors -- a few glowing streaks that occasionally cross the card on the
// diagonal, bottom-left to top-right. Anchored at the container's
// bottom-left corner and driven purely by transform, matching the fixed-
// pixel approximation StreakLine already uses below rather than adding new
// layout-tracking machinery for one small effect.
// ============================================================

const METEORS = [
  { delay: 900, gap: 5200, dur: 950, size: 8, color: '#FFE28A', lane: 0 },
  { delay: 3400, gap: 6400, dur: 800, size: 6, color: '#2E9BFF', lane: 1 },
  { delay: 6200, gap: 5800, dur: 1050, size: 7, color: '#FFFFFF', lane: 2 },
];

function MeteorField() {
  return (
    <>
      {METEORS.map((m, i) => (
        <Meteor key={i} {...m} />
      ))}
    </>
  );
}

function Meteor({
  delay, gap, dur, size, color, lane,
}: { delay: number; gap: number; dur: number; size: number; color: string; lane: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: dur, easing: Easing.linear }),
          withDelay(gap, withTiming(1, { duration: 0 })),
        ),
        -1,
      ),
    );
  }, []);

  const laneX = lane * 26;
  const laneY = lane * 18;

  const style = useAnimatedStyle(() => ({
    opacity: t.value > 0 && t.value < 1 ? Math.sin(t.value * Math.PI) : 0,
    transform: [
      { translateX: -10 + laneX + t.value * 300 },
      { translateY: 10 - laneY - t.value * 260 },
      // Tilts the head (right end of the gradient below) up-and-right so it
      // points along its own bottom-left-to-top-right travel direction.
      { rotate: '-40deg' },
    ],
  }));

  return (
    <Animated.View style={[style, styles.meteorAnchor]} pointerEvents="none">
      <LinearGradient
        colors={['transparent', color]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ width: 46, height: 2, borderRadius: 1 }}
      />
      <View style={{ position: 'absolute', right: -size / 2, top: -(size - 2) / 2 }}>
        <SoftOrb size={size} color={color} opacity={1} core={0.25} />
      </View>
    </Animated.View>
  );
}

function BurstLine({ angle, pulse, color }: { angle: number; pulse: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: 0.15 + pulse.value * 0.55,
    transform: [{ rotate: `${angle}deg` }, { scaleY: 0.55 + pulse.value * 0.55 }],
  }));

  return (
    <Animated.View style={[styles.burstAnchor, style]}>
      <View style={[styles.burstLine, { backgroundColor: color }]} />
    </Animated.View>
  );
}

// ============================================================
// Turbo Circuit -- racing: sharp speed-line streaks tearing across
// plus two pulsing headlight glows.
// ============================================================

const STREAKS = [
  { top: '20%', delay: 0, duration: 520, width: 90 },
  { top: '45%', delay: 550, duration: 420, width: 60 },
  { top: '65%', delay: 220, duration: 480, width: 110 },
  { top: '82%', delay: 900, duration: 400, width: 50 },
];

function TurboLayer() {
  const glowA = useSharedValue(0);
  const glowB = useSharedValue(0);

  useEffect(() => {
    glowA.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    glowB.value = withDelay(400, withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, []);

  const glowAStyle = useAnimatedStyle(() => ({ opacity: 0.15 + glowA.value * 0.35 }));
  const glowBStyle = useAnimatedStyle(() => ({ opacity: 0.15 + glowB.value * 0.35 }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.headlight, glowAStyle, { left: -20, backgroundColor: '#2E9BFF' }]} />
      <Animated.View style={[styles.headlight, glowBStyle, { right: -20, backgroundColor: '#FF3D3D' }]} />
      {STREAKS.map((s, i) => (
        <StreakLine key={i} top={s.top as DimensionValue} delay={s.delay} duration={s.duration} width={s.width} />
      ))}
    </View>
  );
}

function StreakLine({ top, delay, duration, width }: { top: DimensionValue; delay: number; duration: number; width: number }) {
  const progress = useSharedValue(-1);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.4, { duration, easing: Easing.out(Easing.cubic) }),
          withDelay(900, withTiming(-1, { duration: 0 })),
        ),
        -1,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value > -1 && progress.value < 1.4 ? 1 : 0,
    transform: [{ translateX: progress.value * 260 }, { rotate: '-6deg' }],
  }));

  return <Animated.View style={[styles.streak, style, { top, width }]} />;
}

// ============================================================
// Shared: small glowing particles, either rising (fire) or
// scattered short flickers (sparks) depending on `rise`.
// ============================================================

function SparkField({ colors, count, spread, rise }: { colors: string[]; count: number; spread: number; rise?: boolean }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    left: `${10 + (i * 83) % (80 * spread + 10)}%` as DimensionValue,
    delay: (i * 370) % 2600,
    duration: rise ? 2600 + (i % 4) * 450 : 900 + (i % 3) * 300,
    size: rise ? 3 + (i % 3) : 2 + (i % 2),
    color: colors[i % colors.length],
  }));

  return (
    <>
      {particles.map((p, i) => (
        <SparkParticle key={i} {...p} rise={!!rise} />
      ))}
    </>
  );
}

function SparkParticle({
  left, delay, duration, size, color, rise,
}: { left: DimensionValue; delay: number; duration: number; size: number; color: string; rise: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.quad) }), -1));
  }, []);

  const style = useAnimatedStyle(() => {
    const fadeIn = 0.15;
    const fadeOut = 0.7;
    const opacity = t.value < fadeIn ? t.value / fadeIn : t.value > fadeOut ? Math.max(0, (1 - t.value) / (1 - fadeOut)) : 1;
    return {
      opacity,
      transform: rise
        ? [{ translateY: 70 - t.value * 100 }, { translateX: Math.sin(t.value * Math.PI * 2) * 8 }]
        : [{ translateY: -t.value * 26 }, { translateX: (t.value - 0.5) * 20 }, { scale: 0.6 + t.value * 0.8 }],
    };
  });

  return (
    <Animated.View
      style={[
        style,
        { position: 'absolute', left, bottom: rise ? 0 : '45%', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  burstAnchor: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 },
  burstLine: { position: 'absolute', left: -1.5, top: -120, width: 3, height: 120, borderRadius: 2 },
  headlight: {
    position: 'absolute', top: '30%', width: 90, height: 90, borderRadius: 45,
  },
  streak: {
    position: 'absolute', left: -140, height: 3, borderRadius: 2, backgroundColor: '#ffffffcc',
  },
  meteorAnchor: { position: 'absolute', left: '0%', bottom: 0 },
});
