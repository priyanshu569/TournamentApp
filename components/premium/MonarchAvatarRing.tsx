import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import SoftOrb from './SoftOrb';
import Butterfly from './Butterfly';
import { useAnimationGate, useLoopValue } from './useAnimationGate';
import { MONARCH, WING_PAIRS } from './monarchTokens';

type Props = {
  size: number;
  reduceMotion?: boolean;
  lowPerformance?: boolean;
  children: React.ReactNode;
};

// Two butterflies circling the avatar, at different radii and speeds so they
// pass each other rather than sitting locked in formation.
const ORBIT = [
  { colors: WING_PAIRS[0], size: 17, dur: 9000,  offset: 0,   pad: 0,  flapMs: 300 },
  { colors: WING_PAIRS[1], size: 14, dur: 12500, offset: 165, pad: 7,  flapMs: 360 },
];

// The avatar in a lit clearing: an iridescent ring turning slowly behind it,
// a glow that breathes, and butterflies orbiting the edge.
export default function MonarchAvatarRing({ size, reduceMotion, lowPerformance, children }: Props) {
  const { active, motionOff } = useAnimationGate(reduceMotion);

  const ringSize = size + 12;
  const orbitRadius = ringSize / 2 + 8;
  // Visual diameter of the glow.
  const haloSize = ringSize + 30;
  // The box actually reserved in the surrounding layout. Pinned to match
  // Classic (size + 6) so banner cards -- which hug their content, no fixed
  // height -- come out the same height across every theme. The glow still
  // renders at full visual size; it just overflows this smaller box.
  const layoutSize = size + 6;

  const spin = useLoopValue(active, 0, () =>
    withRepeat(withTiming(360, { duration: 11000, easing: Easing.linear }), -1),
  );

  const breathe = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + breathe.value * 0.35,
    transform: [{ scale: 0.94 + breathe.value * 0.12 }],
  }));

  return (
    <View style={{ width: layoutSize, height: layoutSize, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={[glowStyle, { position: 'absolute' }]} pointerEvents="none">
        <SoftOrb size={haloSize} color={MONARCH.blush} opacity={0.55} core={0.44} />
      </Animated.View>

      {/* Rotating gradient clipped to a circle -- the same trick the other
          themes use to get a conic-looking ring without an SVG stroke. */}
      <Animated.View
        style={[
          spinStyle,
          { position: 'absolute', width: ringSize, height: ringSize, borderRadius: ringSize / 2, overflow: 'hidden' },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[MONARCH.rose, MONARCH.crimson, MONARCH.raspberry, MONARCH.coral, MONARCH.gold, MONARCH.rose]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: ringSize * 1.6, height: ringSize * 1.6,
            marginLeft: -ringSize * 0.3, marginTop: -ringSize * 0.3,
          }}
        />
      </Animated.View>

      {!lowPerformance && !motionOff && ORBIT.map((o, i) => (
        <OrbitButterfly key={i} {...o} radius={orbitRadius + o.pad} active={active} />
      ))}

      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

function OrbitButterfly({
  colors, size, dur, offset, radius, flapMs, active,
}: {
  colors: [string, string]; size: number; dur: number; offset: number;
  radius: number; flapMs: number; active: boolean;
}) {
  const angle = useLoopValue(active, offset, () =>
    withRepeat(withTiming(offset + 360, { duration: dur, easing: Easing.linear }), -1),
  );

  // Shallower floor than the banner swarm: these orbit butterflies are the
  // smallest on screen (14-17px), so they need the least extreme fold to
  // stay readable.
  const flap = useLoopValue(active, 1, () =>
    withRepeat(withTiming(0.48, { duration: flapMs, easing: Easing.inOut(Easing.quad) }), -1, true),
  );

  // Rotate-then-translate on a zero-size anchor = circular orbit. Both must
  // share one transform array or the second style would discard the first.
  // The butterfly inherits the orbit's rotation, which reads as it banking
  // into the turn.
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }, { translateY: -radius }],
  }));

  return (
    <Animated.View style={[style, { position: 'absolute', width: 0, height: 0 }]} pointerEvents="none">
      <View style={{ position: 'absolute', left: -size / 2, top: -size / 2 }}>
        <Butterfly size={size} colors={colors} flap={flap} />
      </View>
    </Animated.View>
  );
}
