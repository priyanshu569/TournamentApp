import { useState } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle, withRepeat, withSequence, withDelay, withTiming, Easing, interpolateColor,
} from 'react-native-reanimated';
import {
  LavaFlow, BaseFireGlow, FlameField, HeatHaze, EmberField, SmokeVeil, SparkBursts,
  RoarBloom, DragonBreath,
} from './DragonLayers';
import { useAnimationGate, useLoopValue } from './useAnimationGate';
import { DRAGON, DragonIntensity, resolveDragonConfig } from './dragonTokens';

export type DragonWrathBannerProps = {
  isPremium?: boolean;
  intensity?: DragonIntensity;
  /** Drops smoke/haze and thins particles for weaker devices. */
  lowPerformance?: boolean;
  /** Force-disable motion. Omit to follow the OS accessibility setting. */
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

// "Dragon's Wrath" -- the top-tier profile cosmetic.
//
// A living volcano: molten lava beneath cracked obsidian, fire, heat, smoke
// and embers. The dragon is present only as its fire, never as a creature.
//
// Draw order (far -> near):
//   base -> lava under obsidian -> base fire glow -> dragon breath -> smoke
//   -> flames -> heat haze -> embers -> sparks -> roar bloom -> border
//
// Two global beats are owned here rather than by the layers, so every layer
// spikes on the same frame:
//   breath ~14s   fire sweeps diagonally behind the avatar
//   roar   ~26s   the whole volcano surges, the "wow" beat
export default function DragonWrathBanner({
  isPremium = true,
  intensity = 'balanced',
  lowPerformance,
  reduceMotion,
  style,
  children,
}: DragonWrathBannerProps) {
  const { active, motionOff } = useAnimationGate(reduceMotion);
  const { width: windowWidth } = useWindowDimensions();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const cfg = resolveDragonConfig(intensity, lowPerformance);
  const borderRadius = (StyleSheet.flatten(style)?.borderRadius as number) ?? 22;

  const width = size.width || windowWidth;
  const height = size.height || 160;

  // ---- global beats ----
  const breath = useLoopValue(active, 0, () =>
    withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(13000, withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) })),
        withDelay(600, withTiming(0, { duration: 0 })),
      ),
      -1,
    ),
  );

  const roar = useLoopValue(active, 0, () =>
    withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        // Snap up, hold, then a long decay back to calm.
        withDelay(22000, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })),
        withTiming(0.72, { duration: 620, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    ),
  );

  // Forged-metal border: gold at rest, white-hot at the roar peak.
  const forgedBorder = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      Math.min(1, forgedBorder.value * 0.5 + roar.value),
      [0, 0.5, 1],
      [DRAGON.crimson, DRAGON.molten, DRAGON.gold],
    ),
    opacity: 0.6 + forgedBorder.value * 0.25 + roar.value * 0.15,
  }));

  function onLayout(e: LayoutChangeEvent) {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  }

  if (!isPremium) {
    return (
      <LinearGradient colors={DRAGON.base} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
        {children}
      </LinearGradient>
    );
  }

  return (
    <View style={[style, styles.clip]} onLayout={onLayout}>
      <LinearGradient colors={DRAGON.base} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />

      <LavaFlow active={active} roar={roar} />
      <BaseFireGlow active={active} height={height} />

      <DragonBreath breath={breath} width={width} height={height} />

      <SmokeVeil active={active} count={cfg.smokeCount} opacity={cfg.smokeOpacity} />
      <FlameField active={active} roar={roar} count={cfg.flameCount} opacity={cfg.flameOpacity} width={width} />
      {cfg.showHeatHaze && !motionOff && <HeatHaze active={active} width={width} />}
      <EmberField active={active} count={cfg.emberCount} height={height} />
      <SparkBursts active={active} count={cfg.sparkCount} height={height} />

      <RoarBloom roar={roar} peak={cfg.roarPeak} />

      <Animated.View
        style={[StyleSheet.absoluteFill, borderStyle, { borderRadius, borderWidth: 1.5 }]}
        pointerEvents="none"
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
