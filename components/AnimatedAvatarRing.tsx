import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { BannerTheme, RING_GRADIENTS, RING_ROTATE_MS } from './bannerThemes';
import PremiumAvatarAura from './premium/PremiumAvatarAura';
import { useAppTheme } from '@/lib/ThemeContext';

type Props = {
  theme: BannerTheme | null;
  size: number;
  children: React.ReactNode;
};

// A continuously-rotating LinearGradient behind the avatar, sized just
// large enough to peek out as a ring around it -- avoids needing an SVG
// conic-gradient stroke (no new dependency): rotating a plain linear
// gradient inside a circular mask reads as a spinning ring just as well.
export default function AnimatedAvatarRing({ theme, size, children }: Props) {
  const { colors } = useAppTheme();
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    // 'nebula' renders PremiumAvatarAura instead, which drives its own
    // animations -- starting these too would burn UI-thread work on values
    // nothing reads.
    if (!theme || theme === 'nebula') return;
    rotation.value = 0;
    rotation.value = withRepeat(withTiming(360, { duration: RING_ROTATE_MS[theme], easing: Easing.linear }), -1);
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [theme]);

  const ringAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + pulse.value * 0.3,
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  if (!theme) {
    return (
      <View style={[styles.classicRing, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, borderColor: colors.accent }]}>
        {children}
      </View>
    );
  }

  // Premium themes ship their own avatar treatment (halo + orbiting particles).
  if (theme === 'nebula') {
    return <PremiumAvatarAura size={size}>{children}</PremiumAvatarAura>;
  }

  const ringSize = size + 10;
  const wrapSize = ringSize + 16;
  const gradientColors = RING_GRADIENTS[theme];

  return (
    <View style={{ width: wrapSize, height: wrapSize, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          glowAnimStyle,
          {
            position: 'absolute', width: wrapSize, height: wrapSize, borderRadius: wrapSize / 2,
            backgroundColor: gradientColors[0],
          },
        ]}
      />
      <Animated.View
        style={[
          ringAnimStyle,
          { position: 'absolute', width: ringSize, height: ringSize, borderRadius: ringSize / 2, overflow: 'hidden' },
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: ringSize * 1.6, height: ringSize * 1.6,
            marginLeft: -ringSize * 0.3, marginTop: -ringSize * 0.3,
          }}
        />
      </Animated.View>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  classicRing: {
    padding: 3, borderWidth: 2, justifyContent: 'center', alignItems: 'center',
  },
});
