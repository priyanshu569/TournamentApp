import { useEffect, useMemo } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { BannerTheme, BASE_GRADIENTS } from './bannerThemes';

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

  return (
    <View style={[style, styles.clip]}>
      <LinearGradient colors={BASE_GRADIENTS[theme]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {theme === 'aurora' && <AuroraLayer />}
      {theme === 'holographic' && <HolographicLayer />}
      {theme === 'ember' && <EmberLayer />}
      {children}
    </View>
  );
}

function AuroraLayer() {
  const a = useSharedValue(0);
  const b = useSharedValue(0);

  useEffect(() => {
    a.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }), -1, true);
    b.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);

  const blobA = useAnimatedStyle(() => ({
    transform: [
      { translateX: -30 + a.value * 70 },
      { translateY: -20 + a.value * 30 },
      { rotate: `${a.value * 40}deg` },
    ],
  }));
  const blobB = useAnimatedStyle(() => ({
    transform: [
      { translateX: 40 - b.value * 80 },
      { translateY: 10 - b.value * 40 },
      { rotate: `${-b.value * 30}deg` },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.blob, blobA, { backgroundColor: '#00D4AA', opacity: 0.35 }]} />
      <Animated.View style={[styles.blob, blobB, { backgroundColor: '#7C3AED', opacity: 0.4, left: '40%' }]} />
    </View>
  );
}

function HolographicLayer() {
  const sweep = useSharedValue(-1);

  useEffect(() => {
    sweep.value = withRepeat(
      withSequence(
        withTiming(2, { duration: 1300, easing: Easing.out(Easing.cubic) }),
        withDelay(1800, withTiming(-1, { duration: 0 })),
      ),
      -1,
    );
  }, []);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * 220 }, { rotate: '20deg' }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#ff6ec733', '#7c3aed22', '#2e9bff33', '#00e5c722']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.sweepBand, sweepStyle]} />
    </View>
  );
}

const EMBER_PARTICLES = Array.from({ length: 9 }, (_, i) => ({
  left: `${8 + (i * 97) % 88}%` as DimensionValue,
  delay: (i * 430) % 3000,
  duration: 3200 + (i % 4) * 500,
  size: 3 + (i % 3),
}));

function EmberLayer() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#FF6B3522', '#FF3D3D11', 'transparent']}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {EMBER_PARTICLES.map((p, i) => (
        <EmberParticle key={i} left={p.left} delay={p.delay} duration={p.duration} size={p.size} />
      ))}
    </View>
  );
}

function EmberParticle({ left, delay, duration, size }: { left: DimensionValue; delay: number; duration: number; size: number }) {
  const rise = useSharedValue(0);

  useEffect(() => {
    rise.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.out(Easing.quad) }), -1));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: rise.value < 0.15 ? rise.value / 0.15 : rise.value > 0.75 ? (1 - rise.value) / 0.25 : 1,
    transform: [
      { translateY: 70 - rise.value * 100 },
      { translateX: Math.sin(rise.value * Math.PI * 2) * 8 },
    ],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute', left, bottom: 0, width: size, height: size, borderRadius: size / 2,
          backgroundColor: '#FFB800',
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  blob: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -40, left: -20,
  },
  sweepBand: {
    position: 'absolute', top: -60, bottom: -60, width: 70,
    backgroundColor: '#ffffff2e',
  },
});
