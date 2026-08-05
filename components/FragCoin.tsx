import { memo, useId } from 'react';
import { View, Text, StyleProp, TextStyle, ViewStyle } from 'react-native';
import Svg, {
  Defs, LinearGradient as SvgLinearGradient, RadialGradient, Stop, Circle, Path,
} from 'react-native-svg';

// The FragCoin mark. Gold like the leaderboard trophy (same palette), but
// faceted rather than round-and-flat so it reads as a gaming token instead
// of generic currency -- a hexagonal inner bezel, an angular italic "F"
// lifted from the Fragify wordmark, and a rim highlight for depth.
//
// The "F" is brand purple rather than the usual dark-brown-on-gold: it
// stays legible down to ~14px while actually tying the coin to Fragify.

const GOLD_LIGHT = '#FFE9A8';
const GOLD_MID = '#FFB800';
const GOLD_DEEP = '#C88A06';
const GOLD_EDGE = '#8A5D02';
const BRAND_PURPLE = '#3D1178';

// Italic F -- top-heavy and leaning right for a bit of speed. Drawn in a
// 100x100 box so it can scale with the coin. Sized so its far corners stay
// inside the hexagon's INradius (36*cos30 = 31.18), not just the circle --
// otherwise the mark visibly crosses the bezel's stroke at the top-right
// and bottom-left corners.
const F_MARK = 'M 42.1 29.8 L 72.0 29.8 L 68.9 40.3 L 51.8 40.3 L 49.6 48.2 L 63.2 48.2 L 60.1 58.8 L 46.9 58.8 L 43.0 73.8 L 30.6 73.8 Z';
// Pointy-top hexagon, circumradius 36, centred at 50,50.
const HEX = 'M 50 14 L 81.2 32 L 81.2 68 L 50 86 L 18.8 68 L 18.8 32 Z';
// Rim highlight sweeping the upper-left, where a light source would catch it.
const SHINE = 'M 43.4 12.6 A 38 38 0 0 0 12.6 43.4';

function FragCoinBase({ size = 18 }: { size?: number }) {
  // useId can contain characters that are invalid inside url(#...), so strip
  // anything non-alphanumeric before using it as an SVG id.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const faceId = `coinFace${uid}`;
  const bezelId = `coinBezel${uid}`;
  const edgeId = `coinEdge${uid}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        {/* Off-centre so the coin reads as lit from the upper-left. */}
        <RadialGradient id={faceId} cx="38%" cy="32%" r="72%">
          <Stop offset="0" stopColor={GOLD_LIGHT} />
          <Stop offset="0.55" stopColor={GOLD_MID} />
          <Stop offset="1" stopColor={GOLD_DEEP} />
        </RadialGradient>
        <SvgLinearGradient id={bezelId} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={GOLD_MID} />
          <Stop offset="1" stopColor={GOLD_DEEP} />
        </SvgLinearGradient>
        <SvgLinearGradient id={edgeId} x1="0" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={GOLD_DEEP} />
          <Stop offset="1" stopColor={GOLD_EDGE} />
        </SvgLinearGradient>
      </Defs>

      {/* Struck edge, then the face inset inside it. */}
      <Circle cx="50" cy="50" r="49" fill={`url(#${edgeId})`} />
      <Circle cx="50" cy="50" r="44" fill={`url(#${faceId})`} />

      {/* Faceted bezel -- the bit that stops it looking like a plain disc. */}
      <Path d={HEX} fill={`url(#${bezelId})`} opacity={0.55} />
      <Path d={HEX} stroke={GOLD_LIGHT} strokeWidth={1.6} fill="none" opacity={0.5} />

      <Path d={F_MARK} fill={BRAND_PURPLE} />

      <Path d={SHINE} stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.45} />
    </Svg>
  );
}

export const FragCoin = memo(FragCoinBase);

type CoinAmountProps = {
  amount: number | string;
  size?: number;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  /** Appends " FragCoins" after the number -- for places with room to spell it out. */
  showLabel?: boolean;
};

// Coin + formatted number on one baseline. Most places that show a balance
// or a price want exactly this, and an SVG can't live inside a <Text>, so
// the row wrapper lives here instead of at every call site.
export const CoinAmount = memo(function CoinAmount({
  amount, size = 15, textStyle, style, showLabel = false,
}: CoinAmountProps) {
  const formatted = typeof amount === 'number' ? amount.toLocaleString('en-IN') : amount;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: size * 0.28 }, style]}>
      <FragCoin size={size} />
      <Text style={textStyle}>{formatted}{showLabel ? ' FragCoins' : ''}</Text>
    </View>
  );
});

export default FragCoin;
