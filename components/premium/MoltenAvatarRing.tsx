import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withRepeat, withSequence, withDelay, withTiming, Easing } from 'react-native-reanimated';
import SoftOrb from './SoftOrb';
import { useAnimationGate, useLoopValue } from './useAnimationGate';
import { DRAGON } from './dragonTokens';

type Props = {
  size: number;
  reduceMotion?: boolean;
  lowPerformance?: boolean;
  children: React.ReactNode;
};

const ORBIT_EMBERS = [
  { color: DRAGON.molten, size: 13, dur: 5200, offset: 0,   pad: 0 },
  { color: DRAGON.gold,   size: 10, dur: 7400, offset: 120, pad: 6 },
  { color: DRAGON.lava,   size: 12, dur: 9200, offset: 240, pad: -5 },
];

// The avatar sits inside a ring of moving lava: a rotating molten gradient
// (the flow), a heat glow that breathes, a periodic flame burst, and embers
// orbiting at different radii.
export default function MoltenAvatarRing({ size, reduceMotion, lowPerformance, children }: Props) {
  const { active } = useAnimationGate(reduceMotion);

  const ringSize = size + 12;
  const orbitRadius = ringSize / 2 + 7;
  const wrapSize = ringSize + 36;

  const flow = useLoopValue(active, 0, () =>
    withRepeat(withTiming(360, { duration: 6200, easing: Easing.linear }), -1),
  );
  const heat = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true),
  );
  // Flame burst every ~7s, fast in and slow out.
  const burst = useLoopValue(active, 0, () =>
    withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(5600, withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) })),
        withTiming(0, { duration: 1100, easing: Easing.in(Easing.quad) }),
      ),
      -1,
    ),
  );

  const flowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${flow.value}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + heat.value * 0.4 + burst.value * 0.4,
    transform: [{ scale: 0.92 + heat.value * 0.16 + burst.value * 0.22 }],
  }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value * 0.8,
    transform: [{ scale: 1 + burst.value * 0.35 }],
  }));

  return (
    <View style={{ width: wrapSize, height: wrapSize, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={[glowStyle, { position: 'absolute' }]} pointerEvents="none">
        <SoftOrb size={wrapSize} color={DRAGON.molten} opacity={0.62} core={0.42} />
      </Animated.View>

      <Animated.View style={[burstStyle, { position: 'absolute' }]} pointerEvents="none">
        <SoftOrb size={wrapSize + 10} color={DRAGON.gold} opacity={0.5} core={0.3} />
      </Animated.View>

      {/* Molten flow inside the ring -- a rotating gradient clipped to a
          circle, the same trick the other themes use for their rings. */}
      <Animated.View
        style={[
          flowStyle,
          { position: 'absolute', width: ringSize, height: ringSize, borderRadius: ringSize / 2, overflow: 'hidden' },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[DRAGON.gold, DRAGON.molten, DRAGON.deepRed, DRAGON.obsidian, DRAGON.burnt, DRAGON.gold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: ringSize * 1.6, height: ringSize * 1.6,
            marginLeft: -ringSize * 0.3, marginTop: -ringSize * 0.3,
          }}
        />
      </Animated.View>

      {!lowPerformance && ORBIT_EMBERS.map((e, i) => (
        <OrbitEmber key={i} {...e} radius={orbitRadius + e.pad} active={active} />
      ))}

      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

function OrbitEmber({
  color, size, dur, offset, radius, active,
}: { color: string; size: number; dur: number; offset: number; radius: number; active: boolean }) {
  const angle = useLoopValue(active, offset, () =>
    withRepeat(withTiming(offset + 360, { duration: dur, easing: Easing.linear }), -1),
  );

  // Rotate-then-translate on a zero-size anchor = circular orbit. Both must
  // share one transform array or the second style would discard the first.
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }, { translateY: -radius }],
  }));

  return (
    <Animated.View style={[style, { position: 'absolute', width: 0, height: 0 }]} pointerEvents="none">
      <View style={{ position: 'absolute', left: -size / 2, top: -size / 2 }}>
        <SoftOrb size={size} color={color} opacity={0.95} core={0.28} />
      </View>
    </Animated.View>
  );
}
