import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';
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
