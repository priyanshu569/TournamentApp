import { useState } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MeadowGlow, PollenField, LightRays, ButterflySwarm, IridescentSweep, MonarchBorder,
} from './MonarchLayers';
import { useAnimationGate } from './useAnimationGate';
import { MONARCH, MonarchIntensity, resolveMonarchConfig } from './monarchTokens';

export type MonarchBannerProps = {
  /** When false, renders the static base gradient only -- the graceful
   *  fallback for a lapsed or never-subscribed account. */
  isPremium?: boolean;
  intensity?: MonarchIntensity;
  /** Drops rays and thins the swarm for weaker devices. */
  lowPerformance?: boolean;
  /** Force-disable motion. Omit to follow the OS accessibility setting. */
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

// "Monarch" -- a twilight garden with butterflies drifting through it.
//
// Nothing here shares a clock: every glow, mote, ray and butterfly runs on
// its own duration, which is what stops it reading as a looping wallpaper.
// Every layer animates transform/opacity only, so the whole composition
// lives on the UI thread and never re-renders after mount.
//
// Draw order (far -> near):
//   base -> meadow glow -> rays -> pollen -> butterflies -> sweep -> border
export default function MonarchBanner({
  isPremium = true,
  intensity = 'balanced',
  lowPerformance,
  reduceMotion,
  style,
  children,
}: MonarchBannerProps) {
  const { active, motionOff } = useAnimationGate(reduceMotion);
  const { width: windowWidth } = useWindowDimensions();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const cfg = resolveMonarchConfig(intensity, lowPerformance);
  // The card's radius is owned by the calling screen's style, so read it back
  // out to draw the glowing outline at the right shape.
  const borderRadius = (StyleSheet.flatten(style)?.borderRadius as number) ?? 22;

  function onLayout(e: LayoutChangeEvent) {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  }

  const width = size.width || windowWidth;
  const height = size.height || 160;

  if (!isPremium) {
    return (
      <LinearGradient colors={MONARCH.base} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
        {children}
      </LinearGradient>
    );
  }

  return (
    <View style={[style, styles.clip]} onLayout={onLayout}>
      <LinearGradient colors={MONARCH.base} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />

      <MeadowGlow active={active} opacity={cfg.glowOpacity} />
      {cfg.showRays && <LightRays active={active} opacity={cfg.rayOpacity} height={height} />}
      <PollenField active={active} count={cfg.pollenCount} />

      {/* Butterflies are skipped outright when motion is off -- a row of
          frozen insects mid-air reads as a broken image, where a still
          garden of glow and pollen still looks intentional. */}
      {!motionOff && (
        <ButterflySwarm active={active} count={cfg.butterflyCount} width={width} height={height} />
      )}

      {!motionOff && <IridescentSweep active={active} opacity={cfg.sweepOpacity} width={width} height={height} />}

      <MonarchBorder active={active} opacity={cfg.borderOpacity} borderRadius={borderRadius} />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
