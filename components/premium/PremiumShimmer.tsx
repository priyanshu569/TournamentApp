import { useState } from 'react';
import { StyleSheet, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withRepeat, withSequence, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { useAnimationGate, useLoopValue } from './useAnimationGate';

type Props = {
  /** Milliseconds between sweeps. Stagger this across elements so the
   *  username and the badge never catch the light at the same instant. */
  periodMs?: number;
  travelMs?: number;
  peakOpacity?: number;
  /** Adds a slow, very shallow scale breath (used by the verified badge). */
  pulse?: boolean;
  /** False renders children untouched, so non-premium themes can share the
   *  same call site without a second JSX branch. */
  enabled?: boolean;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

// Wraps any content (username, verified badge) and periodically slides a soft
// light reflection across it. The text itself is never animated -- only the
// highlight moves, which is what keeps it feeling expensive rather than busy.
export default function PremiumShimmer({
  periodMs = 6000, travelMs = 1100, peakOpacity = 0.28, pulse, enabled = true, reduceMotion, style, children,
}: Props) {
  const { active: gateActive } = useAnimationGate(reduceMotion);
  const active = gateActive && enabled;
  const [width, setWidth] = useState(0);

  const t = useLoopValue(active, 0, () =>
    withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(periodMs, withTiming(1, { duration: travelMs, easing: Easing.inOut(Easing.quad) })),
      ),
      -1,
    ),
  );

  const breath = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: Math.sin(t.value * Math.PI) * peakOpacity,
    transform: [{ translateX: -width * 0.6 + t.value * width * 1.6 }],
  }));

  // Intentionally tiny (3%) -- a visible throb on a verified badge reads as a
  // notification, not as polish.
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse ? 1 + breath.value * 0.03 : 1 }],
  }));

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  return (
    <Animated.View style={[style, pulseStyle]} onLayout={onLayout}>
      {children}
      {enabled && width > 0 && (
        <Animated.View
          style={[
            sweepStyle,
            { position: 'absolute', top: -4, bottom: -4, width: Math.max(28, width * 0.32) },
          ]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['transparent', '#FFFFFF', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}
