import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import SoftOrb from './SoftOrb';
import { useAnimationGate, useLoopValue } from './useAnimationGate';
import { NEBULA } from './premiumTokens';

type Props = {
  size: number;
  reduceMotion?: boolean;
  showParticles?: boolean;
  children: React.ReactNode;
};

const ORBIT_PARTICLES = [
  { color: NEBULA.cyan,   size: 12, dur: 6500,  offset: 0,   radiusPad: 0 },
  { color: NEBULA.purple, size: 15, dur: 9000,  offset: 140, radiusPad: 6 },
  { color: NEBULA.blue,   size: 11, dur: 12000, offset: 255, radiusPad: -5 },
];

// The avatar treatment for the Nebula banner: a breathing halo that blends the
// avatar into the background, a slowly rotating energy ring, and a few
// particles orbiting the ring at different radii and speeds.
export default function PremiumAvatarAura({ size, reduceMotion, showParticles = true, children }: Props) {
  const { active } = useAnimationGate(reduceMotion);

  const ringSize = size + 10;
  const orbitRadius = ringSize / 2 + 6;
  const wrapSize = ringSize + 34;

  const rotation = useLoopValue(active, 0, () =>
    withRepeat(withTiming(360, { duration: 5200, easing: Easing.linear }), -1),
  );
  // 4s in, 4s out -- the "glow expands every 4 seconds" beat from the brief.
  const breath = useLoopValue(active, 0, () =>
    withRepeat(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }), -1, true),
  );

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Capped low on purpose: the halo must never compete with the avatar itself.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.42 + breath.value * 0.48,
    transform: [{ scale: 0.9 + breath.value * 0.24 }],
  }));

  return (
    <View style={{ width: wrapSize, height: wrapSize, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={[haloStyle, { position: 'absolute' }]} pointerEvents="none">
        <SoftOrb size={wrapSize} color={NEBULA.purple} opacity={0.5} core={0.44} />
      </Animated.View>

      <Animated.View
        style={[
          ringStyle,
          { position: 'absolute', width: ringSize, height: ringSize, borderRadius: ringSize / 2, overflow: 'hidden' },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[NEBULA.cyan, NEBULA.blue, NEBULA.purple, NEBULA.royal, NEBULA.cyan]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: ringSize * 1.6, height: ringSize * 1.6,
            marginLeft: -ringSize * 0.3, marginTop: -ringSize * 0.3,
          }}
        />
      </Animated.View>

      {showParticles && ORBIT_PARTICLES.map((p, i) => (
        <OrbitParticle key={i} {...p} radius={orbitRadius + p.radiusPad} active={active} />
      ))}

      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

function OrbitParticle({
  color, size, dur, offset, radius, active,
}: { color: string; size: number; dur: number; offset: number; radius: number; active: boolean }) {
  const angle = useLoopValue(active, offset, () =>
    withRepeat(withTiming(offset + 360, { duration: dur, easing: Easing.linear }), -1),
  );

  // rotate-then-translate on a zero-size anchor puts the particle on a circle:
  // the translation happens along the already-rotated axis. Both transforms
  // must live in this one array -- a second style object would replace it.
  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${angle.value}deg` },
      { translateY: -radius },
    ],
  }));

  return (
    <Animated.View style={[style, { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
      <View style={{ position: 'absolute', left: -size / 2, top: -size / 2 }}>
        <SoftOrb size={size} color={color} opacity={0.9} core={0.3} />
      </View>
    </Animated.View>
  );
}
