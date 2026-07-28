import { useEffect, useState, ReactNode } from 'react';
import { View, StyleSheet, LayoutChangeEvent, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
};

const STREAK_WIDTH = 90;
const SWEEP_DURATION = 1100;
const PAUSE_DURATION = 2600;

// Periodic diagonal light streak that sweeps across whatever it wraps,
// like the shine effect on premium game-UI cards. Needs a defined
// surface (background/border) on the wrapped content to read as
// intentional rather than a stray translucent bar.
export default function ShimmerSweep({ children, style }: Props) {
  const [width, setWidth] = useState(0);
  const translateX = useSharedValue(-STREAK_WIDTH);

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w && w !== width) setWidth(w);
  }

  useEffect(() => {
    if (!width) return;
    translateX.value = -STREAK_WIDTH;
    translateX.value = withRepeat(
      withSequence(
        withTiming(width + STREAK_WIDTH, { duration: SWEEP_DURATION }),
        withDelay(PAUSE_DURATION, withTiming(-STREAK_WIDTH, { duration: 0 }))
      ),
      -1
    );
  }, [width]);

  const streakStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { rotate: '18deg' }],
  }));

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      {children}
      {width > 0 && (
        <Animated.View style={[styles.streak, streakStyle]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.28)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  streak: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: STREAK_WIDTH,
  },
});
