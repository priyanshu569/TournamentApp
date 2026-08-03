import { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Path, Ellipse, G } from 'react-native-svg';
import { DRAGON } from './dragonTokens';

// Hand-authored vector geometry for the dragon. There is no bitmap artwork
// anywhere in this app, so every shape here is path data written by hand.
// They are designed to be read at LOW opacity through smoke -- silhouettes,
// not illustrations. The eyes carry most of the recognition weight, which is
// why they get the most detail (slit pupils + a separate glow pass).

function uid(prefix: string, raw: string) {
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, '')}`;
}

// ---- Face -------------------------------------------------------------
// A front-facing, symmetric dragon head used as a large background presence.
// Front-on is a deliberate choice over a profile view: symmetry is far easier
// to make read as "dragon" in hand-written path data, and the horn/brow/snout
// triangle is recognisable even at very low opacity behind smoke.
const FACE_SKULL = 'M 120 194 C 102 188, 86 170, 76 144 C 66 118, 62 88, 70 62 C 78 40, 98 28, 120 28 C 142 28, 162 40, 170 62 C 178 88, 174 118, 164 144 C 154 170, 138 188, 120 194 Z';
const HORN_UPPER_L = 'M 84 44 C 68 28, 44 14, 12 6 C 36 20, 56 38, 72 60 Z';
const HORN_UPPER_R = 'M 156 44 C 172 28, 196 14, 228 6 C 204 20, 184 38, 168 60 Z';
const HORN_LOWER_L = 'M 74 78 C 56 70, 34 66, 10 68 C 34 76, 54 86, 70 96 Z';
const HORN_LOWER_R = 'M 166 78 C 184 70, 206 66, 230 68 C 206 76, 186 86, 170 96 Z';
const BROW_L = 'M 76 96 L 118 108 L 114 118 L 74 106 Z';
const BROW_R = 'M 164 96 L 122 108 L 126 118 L 166 106 Z';
const EYE_L = 'M 80 112 C 90 104, 106 110, 114 118 C 104 126, 86 124, 80 112 Z';
const EYE_R = 'M 160 112 C 150 104, 134 110, 126 118 C 136 126, 154 124, 160 112 Z';
const SNOUT = 'M 100 132 C 110 128, 130 128, 140 132 L 137 160 C 130 166, 110 166, 103 160 Z';
const FANG_L = 'M 104 162 L 109 181 L 114 163 Z';
const FANG_R = 'M 126 163 L 131 181 L 136 162 Z';
const CHEEK_RIDGES = 'M 82 130 L 96 136 M 80 143 L 94 147 M 158 130 L 144 136 M 160 143 L 146 147';

/** Eye centres as fractions of the face box, so callers can position an
 *  animated glow exactly over the sockets without hardcoding pixel offsets. */
export const FACE_EYES = [
  { x: 97 / 240, y: 116 / 200 },
  { x: 143 / 240, y: 116 / 200 },
];

export const FACE_ASPECT = 200 / 240;

export const DragonFace = memo(function DragonFace({ width }: { width: number }) {
  const id = useId();
  const skullId = uid('skull', id);
  const hornId = uid('fhorn', id);
  const irisId = uid('firis', id);
  const height = width * FACE_ASPECT;

  return (
    <Svg width={width} height={height} viewBox="0 0 240 200">
      <Defs>
        <LinearGradient id={skullId} x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={DRAGON.crimson} stopOpacity={0.95} />
          <Stop offset="0.55" stopColor={DRAGON.obsidian} stopOpacity={0.98} />
          <Stop offset="1" stopColor={DRAGON.shadowPurple} stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id={hornId} x1="1" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={DRAGON.crimson} />
          <Stop offset="1" stopColor={DRAGON.burnt} />
        </LinearGradient>
        <RadialGradient id={irisId} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={DRAGON.gold} />
          <Stop offset="0.6" stopColor={DRAGON.molten} />
          <Stop offset="1" stopColor={DRAGON.deepRed} />
        </RadialGradient>
      </Defs>

      <Path d={HORN_UPPER_L} fill={`url(#${hornId})`} />
      <Path d={HORN_UPPER_R} fill={`url(#${hornId})`} />
      <Path d={HORN_LOWER_L} fill={`url(#${hornId})`} opacity={0.8} />
      <Path d={HORN_LOWER_R} fill={`url(#${hornId})`} opacity={0.8} />

      <Path d={FACE_SKULL} fill={`url(#${skullId})`} />

      <Path d={BROW_L} fill={DRAGON.obsidian} opacity={0.85} />
      <Path d={BROW_R} fill={DRAGON.obsidian} opacity={0.85} />

      <Path d={EYE_L} fill={`url(#${irisId})`} />
      <Path d={EYE_R} fill={`url(#${irisId})`} />
      {/* Slit pupils -- the detail that stops these reading as lamps. */}
      <Ellipse cx="97" cy="116" rx="3.5" ry="9" fill="#12060A" />
      <Ellipse cx="143" cy="116" rx="3.5" ry="9" fill="#12060A" />

      <Path d={SNOUT} fill={DRAGON.obsidian} opacity={0.75} />
      <Ellipse cx="112" cy="143" rx="3.5" ry="5" fill="#0A0405" />
      <Ellipse cx="128" cy="143" rx="3.5" ry="5" fill="#0A0405" />

      <Path d={FANG_L} fill={DRAGON.gold} opacity={0.75} />
      <Path d={FANG_R} fill={DRAGON.gold} opacity={0.75} />

      <Path d={CHEEK_RIDGES} stroke={DRAGON.burnt} strokeWidth={1.4} fill="none" opacity={0.45} />
    </Svg>
  );
});

// ---- Wing -------------------------------------------------------------
// Scalloped trailing edge (the notches between finger bones) is what makes a
// blob read as a wing, so those are exaggerated rather than smoothed.
const WING = 'M 6 150 C 26 96, 74 40, 150 8 L 138 46 L 186 20 L 168 62 L 220 40 L 196 84 L 238 76 L 200 112 C 150 132, 74 148, 6 150 Z';
const WING_BONES = 'M 20 144 L 150 10 M 26 146 L 184 22 M 40 148 L 218 40 M 70 150 L 236 76';

export const DragonWing = memo(function DragonWing({ width }: { width: number }) {
  const id = useId();
  const gid = uid('wing', id);
  const height = width * (160 / 240);

  return (
    <Svg width={width} height={height} viewBox="0 0 240 160">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={DRAGON.obsidian} stopOpacity={0.95} />
          <Stop offset="0.55" stopColor={DRAGON.crimson} stopOpacity={0.8} />
          <Stop offset="1" stopColor={DRAGON.deepRed} stopOpacity={0.5} />
        </LinearGradient>
      </Defs>
      <Path d={WING} fill={`url(#${gid})`} />
      <Path d={WING_BONES} stroke={DRAGON.burnt} strokeWidth={1.2} fill="none" opacity={0.35} />
    </Svg>
  );
});

// ---- Tail -------------------------------------------------------------
const TAIL = 'M 4 62 C 60 58, 130 48, 196 18 L 208 30 L 190 40 L 206 48 L 184 56 L 198 68 C 130 78, 60 74, 4 62 Z';

export const DragonTail = memo(function DragonTail({ width }: { width: number }) {
  const id = useId();
  const gid = uid('tail', id);
  const height = width * (80 / 240);

  return (
    <Svg width={width} height={height} viewBox="0 0 240 80">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={DRAGON.obsidian} stopOpacity={0.2} />
          <Stop offset="0.5" stopColor={DRAGON.crimson} stopOpacity={0.75} />
          <Stop offset="1" stopColor={DRAGON.burnt} stopOpacity={0.6} />
        </LinearGradient>
      </Defs>
      <Path d={TAIL} fill={`url(#${gid})`} />
    </Svg>
  );
});

// ---- Scales -----------------------------------------------------------
// Generated rather than hand-listed: overlapping arc rows, offset every other
// row so they interlock the way real scales do.
export const DragonScales = memo(function DragonScales({ width, rows = 5, cols = 7 }: { width: number; rows?: number; cols?: number }) {
  const id = useId();
  const gid = uid('scale', id);
  const cell = 100 / cols;
  const height = width * ((rows * cell * 0.62) / 100);

  const paths: string[] = [];
  for (let r = 0; r < rows; r++) {
    const y = r * cell * 0.62 + cell * 0.5;
    const offset = r % 2 === 0 ? 0 : cell / 2;
    for (let c = -1; c < cols; c++) {
      const x = c * cell + offset;
      paths.push(`M ${x} ${y} a ${cell / 2} ${cell / 2} 0 0 1 ${cell} 0`);
    }
  }

  return (
    <Svg width={width} height={height} viewBox={`0 0 100 ${rows * cell * 0.62}`}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={DRAGON.burnt} stopOpacity={0.55} />
          <Stop offset="1" stopColor={DRAGON.crimson} stopOpacity={0.2} />
        </LinearGradient>
      </Defs>
      <G>
        {paths.map((d, i) => (
          <Path key={i} d={d} stroke={`url(#${gid})`} strokeWidth={0.9} fill="none" />
        ))}
      </G>
    </Svg>
  );
});

// ---- Full silhouette (roar moment only) -------------------------------
// A roaring head in profile: horns back, jaw open. Only ever shown at low
// opacity for ~1s during the roar, which is what lets a hand-drawn shape
// carry the moment -- it is an impression, not a portrait.
const SILHOUETTE = 'M 10 92 C 20 62, 42 40, 70 32 L 60 8 L 90 28 C 102 22, 116 24, 130 30 L 126 6 L 152 30 C 178 38, 206 46, 236 40 L 228 58 L 196 60 L 206 76 L 178 66 C 158 72, 140 74, 124 72 L 150 92 L 118 84 C 94 92, 60 96, 40 112 C 26 106, 14 100, 10 92 Z';

export const DragonSilhouette = memo(function DragonSilhouette({ width }: { width: number }) {
  const id = useId();
  const gid = uid('sil', id);
  const height = width * (160 / 240);

  return (
    <Svg width={width} height={height} viewBox="0 0 240 160">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={DRAGON.molten} stopOpacity={0.5} />
          <Stop offset="0.5" stopColor={DRAGON.deepRed} stopOpacity={0.7} />
          <Stop offset="1" stopColor={DRAGON.obsidian} stopOpacity={0.9} />
        </LinearGradient>
      </Defs>
      <Path d={SILHOUETTE} fill={`url(#${gid})`} />
    </Svg>
  );
});

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
