import { useState } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientDrift, NebulaClouds, CosmicFog, StarField, GlowParticles, LightSweep, BorderGlow } from './NebulaLayers';
import { useAnimationGate } from './useAnimationGate';
import { NEBULA, INTENSITY, Intensity } from './premiumTokens';

export type PremiumNebulaBannerProps = {
  /** When false, renders the static base gradient only -- the graceful
   *  fallback for a lapsed or never-subscribed account. */
  isPremium?: boolean;
  /** Force-disable motion. Omit to follow the OS accessibility setting. */
  reduceMotion?: boolean;
  showParticles?: boolean;
  intensity?: Intensity;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

// "Nebula" -- the first premium profile banner.
//
// Six independently-timed layers composited back to front. Nothing shares a
// clock, which is what stops it reading as a looping wallpaper. Every layer
// animates transform/opacity only, so the whole thing lives on the UI thread
// and never re-renders after mount.
//
// Draw order (far -> near):
//   base gradient -> nebula clouds -> cosmic fog -> stars
//   -> gradient drift -> glow particles -> light sweep -> border -> content
export default function PremiumNebulaBanner({
  isPremium = true,
  reduceMotion,
  showParticles = true,
  intensity = 'balanced',
  style,
  children,
}: PremiumNebulaBannerProps) {
  const { active, motionOff } = useAnimationGate(reduceMotion);
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(0);

  const cfg = INTENSITY[intensity];
  // The card's radius is owned by the calling screen's style, so read it back
  // out to clip the layers and draw the glowing outline at the right shape.
  const borderRadius = (StyleSheet.flatten(style)?.borderRadius as number) ?? 22;

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  if (!isPremium) {
    return (
      <LinearGradient colors={NEBULA.base} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
        {children}
      </LinearGradient>
    );
  }

  return (
    <View style={[style, styles.clip]} onLayout={onLayout}>
      <LinearGradient colors={NEBULA.base} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />

      <NebulaClouds active={active} opacity={cfg.cloudOpacity} />
      <CosmicFog active={active} opacity={cfg.fogOpacity} />
      <StarField active={active} count={cfg.starCount} />
      <GradientDrift active={active} opacity={cfg.driftOpacity} />
      {showParticles && <GlowParticles active={active} count={cfg.particleCount} />}

      {/* Skipped entirely when motion is off -- a frozen mid-screen streak
          would look like a rendering artefact rather than a highlight. */}
      {!motionOff && <LightSweep active={active} opacity={cfg.sweepOpacity} width={width || windowWidth} />}

      <BorderGlow active={active} opacity={cfg.borderOpacity} borderRadius={borderRadius} />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
