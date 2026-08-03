import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Stop, Path, G } from 'react-native-svg';
import { DRAGON } from './dragonTokens';

// Vector geometry for the Dragon's Wrath banner. All path data is
// hand-authored -- there is no bitmap artwork anywhere in this app.

function uid(prefix: string, raw: string) {
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
}

// ---- Flame ------------------------------------------------------------
// One teardrop tongue with an inner core. Height/sway are animated by the
// caller so a handful of these read as a whole fire.
const FLAME_OUTER = 'M 20 100 C 2 80, 6 50, 18 30 C 20 44, 26 48, 26 38 C 36 56, 38 82, 20 100 Z';
const FLAME_CORE = 'M 20 96 C 11 80, 13 58, 20 46 C 27 58, 29 80, 20 96 Z';

export const Flame = memo(function Flame({ width, height }: { width: number; height: number }) {
  const id = useId();
  const outerId = uid('flameo', id);
  const coreId = uid('flamec', id);

  return (
    <Svg width={width} height={height} viewBox="0 0 40 100">
      <Defs>
        <LinearGradient id={outerId} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={DRAGON.molten} stopOpacity={0.9} />
          <Stop offset="0.55" stopColor={DRAGON.burnt} stopOpacity={0.55} />
          <Stop offset="1" stopColor={DRAGON.deepRed} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={coreId} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={DRAGON.emberCore} stopOpacity={0.95} />
          <Stop offset="0.6" stopColor={DRAGON.lava} stopOpacity={0.5} />
          <Stop offset="1" stopColor={DRAGON.lava} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={FLAME_OUTER} fill={`url(#${outerId})`} />
      <Path d={FLAME_CORE} fill={`url(#${coreId})`} />
    </Svg>
  );
});

// ---- Obsidian cracks --------------------------------------------------
// Branching fissures with a molten stroke. Drawn once; the glow beneath is
// what animates, so this whole component is static and memoized.
const CRACKS = [
  'M -10 38 L 26 44 L 48 34 L 82 46 L 118 38 L 152 50 L 190 42 L 230 52',
  'M 26 44 L 32 72 L 20 96 L 30 130',
  'M 118 38 L 128 66 L 112 92 L 124 124',
  'M 190 42 L 184 70 L 198 96',
  'M -10 108 L 34 114 L 70 104 L 108 116 L 148 106 L 196 118 L 240 110',
  'M 70 104 L 64 76 L 76 52',
];

export const ObsidianCracks = memo(function ObsidianCracks({ width, height }: { width: number; height: number }) {
  const id = useId();
  const gid = uid('crack', id);

  return (
    <Svg width={width} height={height} viewBox="0 0 240 140" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={DRAGON.deepRed} />
          <Stop offset="0.5" stopColor={DRAGON.molten} />
          <Stop offset="1" stopColor={DRAGON.lava} />
        </LinearGradient>
      </Defs>
      {CRACKS.map((d, i) => (
        <G key={i}>
          {/* Wide soft pass underneath = the bloom of light escaping the crack. */}
          <Path d={d} stroke={`url(#${gid})`} strokeWidth={4} fill="none" opacity={0.18} strokeLinecap="round" />
          <Path d={d} stroke={`url(#${gid})`} strokeWidth={1.1} fill="none" opacity={0.9} strokeLinecap="round" />
        </G>
      ))}
    </Svg>
  );
});
