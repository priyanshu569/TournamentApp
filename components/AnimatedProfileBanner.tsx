import { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle, useSharedValue, SharedValue,
  withRepeat, withSequence, withDelay, withTiming, Easing,
} from 'react-native-reanimated';
import { BannerTheme, BASE_GRADIENTS } from './bannerThemes';
import PremiumNebulaBanner from './premium/PremiumNebulaBanner';

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

  return (
    <View style={[style, styles.clip]}>
      <LinearGradient colors={BASE_GRADIENTS[theme]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {theme === 'powersurge' && <PowerSurgeLayer />}
      {theme === 'inferno' && <InfernoLayer />}
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

  const coreStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.45,
    transform: [{ scale: 0.85 + pulse.value * 0.35 }],
  }));

  const lineAngles = Array.from({ length: 14 }, (_, i) => i * (360 / 14));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.coreGlow, coreStyle, { backgroundColor: '#FFD23D' }]} />
      {lineAngles.map((angle, i) => (
        <BurstLine key={i} angle={angle} pulse={pulse} color={i % 3 === 0 ? '#2E9BFF' : '#FFE28A'} />
      ))}
      <SparkField colors={['#FFE28A', '#2E9BFF', '#ffffff']} count={7} spread={0.75} />
    </View>
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
// Inferno -- dragon fire: rising ember particles plus a periodic
// bright "roar" flash across the whole card.
// ============================================================

function InfernoLayer() {
  const flash = useSharedValue(0);

  useEffect(() => {
    flash.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 130, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 900, easing: Easing.in(Easing.cubic) }),
        withDelay(2600, withTiming(0, { duration: 0 })),
      ),
      -1,
    );
  }, []);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#FF6B3530', '#FF1F1F18', 'transparent']}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <SparkField colors={['#FFD23D', '#FF6B35', '#FF1F1F']} count={13} spread={1} rise />
      <Animated.View style={[StyleSheet.absoluteFill, flashStyle, { backgroundColor: '#FF8A3D' }]} />
    </View>
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
  coreGlow: {
    position: 'absolute', top: '50%', left: '50%', width: 140, height: 140,
    marginLeft: -70, marginTop: -70, borderRadius: 70,
  },
  burstAnchor: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 },
  burstLine: { position: 'absolute', left: -1.5, top: -120, width: 3, height: 120, borderRadius: 2 },
  headlight: {
    position: 'absolute', top: '30%', width: 90, height: 90, borderRadius: 45,
  },
  streak: {
    position: 'absolute', left: -140, height: 3, borderRadius: 2, backgroundColor: '#ffffffcc',
  },
});
