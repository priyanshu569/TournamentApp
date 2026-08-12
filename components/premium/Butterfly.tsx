import { memo, useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path, G, Circle } from 'react-native-svg';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { MONARCH } from './monarchTokens';

// Wing silhouette, drawn in a 50x100 half-box where x=0 is the body's centre
// line and x=50 the wingtip. The left wing reuses this exact geometry
// mirrored *inside the SVG* rather than via a negative scaleX on the View --
// that keeps the View's own scaleX free to drive the flap.
const FOREWING = 'M 0 34 C 14 15, 34 3, 45 10 C 50 14, 47 32, 33 44 C 24 51, 9 51, 0 46 Z';
const HINDWING = 'M 0 50 C 11 49, 25 54, 29 64 C 33 76, 24 88, 14 83 C 5 79, 0 68, 0 58 Z';

// Body column + antennae, in a full 100x100 box so its centre line lands
// exactly where the two 50-wide wing halves meet.
const BODY = 'M 50 30 C 53 30, 54.5 40, 54 52 C 53.5 64, 52 74, 50 79 C 48 74, 46.5 64, 46 52 C 45.5 40, 47 30, 50 30 Z';
const ANTENNA_L = 'M 48.5 27 C 44 20, 40 15, 36 12';
const ANTENNA_R = 'M 51.5 27 C 56 20, 60 15, 64 12';

const Wing = memo(function Wing({
  side, width, height, colors,
}: { side: 'left' | 'right'; width: number; height: number; colors: [string, string] }) {
  // useId can contain characters that are invalid inside url(#...), so strip
  // everything non-alphanumeric before using it as an SVG id.
  const gid = `wing${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <Svg width={width} height={height} viewBox="0 0 50 100">
      <Defs>
        <SvgLinearGradient id={gid} x1="0" y1="0.1" x2="1" y2="0.9">
          <Stop offset="0" stopColor={colors[1]} />
          <Stop offset="1" stopColor={colors[0]} />
        </SvgLinearGradient>
      </Defs>
      {/* objectBoundingBox gradient units mean the fill mirrors along with
          the geometry, so both wings stay bright at the tip. */}
      <G transform={side === 'left' ? 'translate(50, 0) scale(-1, 1)' : undefined}>
        <Path d={FOREWING} fill={`url(#${gid})`} />
        {/* Hindwing slightly knocked back so the two overlap with some depth
            instead of reading as one flat blob. */}
        <Path d={HINDWING} fill={`url(#${gid})`} opacity={0.86} />
      </G>
    </Svg>
  );
});

const Body = memo(function Body({ size, accent }: { size: number; accent: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d={BODY} fill={MONARCH.body} />
      <Circle cx={50} cy={28.5} r={3.6} fill={MONARCH.body} />
      {/* Antennae in the wing's tip colour, faint -- at these sizes they're
          barely a hairline, but they're what stops the silhouette reading as
          a leaf rather than a butterfly. */}
      <Path d={ANTENNA_L} stroke={accent} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.55} />
      <Path d={ANTENNA_R} stroke={accent} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.55} />
      <Circle cx={36} cy={12} r={1.8} fill={accent} opacity={0.7} />
      <Circle cx={64} cy={12} r={1.8} fill={accent} opacity={0.7} />
    </Svg>
  );
});

type Props = {
  size: number;
  colors: [string, string];
  /** 1 = wings fully spread, ~0.42 = folded. Callers shouldn't drive this
   *  much below 0.4: butterflies render around 15-35px here, and a real
   *  edge-on fold at that size stops reading as a butterfly and starts
   *  looking like a rendering artefact. */
  flap: SharedValue<number>;
};

// A single butterfly, wings flapping. Both wings share one driver (real ones
// beat symmetrically) and differ only in transformOrigin -- each is anchored
// at the body line, so shrinking scaleX folds the wing toward the body the
// way a real wing foreshortens, instead of squashing it in place.
function Butterfly({ size, colors, flap }: Props) {
  const half = size / 2;

  const wingStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: flap.value }],
    // Edge-on wings catch less light -- a small dip keeps the flap from
    // looking like a flat cutout being scaled.
    opacity: 0.84 + flap.value * 0.16,
  }));

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, transformOrigin: 'right center' }, wingStyle]}>
        <Wing side="left" width={half} height={size} colors={colors} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: half, top: 0, transformOrigin: 'left center' }, wingStyle]}>
        <Wing side="right" width={half} height={size} colors={colors} />
      </Animated.View>
      <View style={{ position: 'absolute', left: 0, top: 0 }}>
        <Body size={size} accent={colors[0]} />
      </View>
    </View>
  );
}

export default memo(Butterfly);
