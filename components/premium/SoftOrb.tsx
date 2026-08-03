import { memo, useId } from 'react';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

type Props = {
  size: number;
  color: string;
  /** Opacity at the very centre of the orb. Falls off to 0 at the edge. */
  opacity?: number;
  /** Where the mid-stop sits (0-1). Lower = tighter core, higher = flatter haze. */
  core?: number;
};

// The blur primitive for the whole premium system. expo-blur isn't a
// dependency here, and a plain rounded View gives a hard edge that reads as
// cheap -- an SVG radial gradient gives true soft falloff using react-native-svg,
// which is already installed. Memoized because these never need to re-render:
// all motion happens on the Animated.View wrapping them.
function SoftOrb({ size, color, opacity = 1, core = 0.5 }: Props) {
  // useId can contain characters that are invalid inside url(#...), so strip
  // everything that isn't alphanumeric before using it as an SVG id.
  const gradientId = `orb${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset={core} stopColor={color} stopOpacity={opacity * 0.32} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gradientId})`} />
    </Svg>
  );
}

export default memo(SoftOrb);
