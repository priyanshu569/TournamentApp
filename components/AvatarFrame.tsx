import { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path, Line, Rect, Polygon, G, Defs, RadialGradient, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing, interpolate } from 'react-native-reanimated';
import { AvatarFrameId, getAvatarFrame } from '@/lib/avatarFrames';

type Props = {
  frameId: string | null | undefined;
  size: number;
  /** Motion is opt-in. Avatars render inside FlatLists on 11 screens, and
   *  animating every row would burn UI-thread work nobody is looking at --
   *  so only profile-scale avatars ask for it. */
  animated?: boolean;
  /** Given the frame's ink colour, render the avatar icon. A function rather
   *  than a child node because Glitch Protocol draws the icon three times in
   *  different channel colours. */
  renderIcon: (color: string) => React.ReactNode;
};

// Everything is authored against a 120-unit square and scaled by viewBox, so
// the geometry below is resolution-independent and matches the design preview
// one-for-one.
const VB = 120;
const C = 60;

/* ---------------------------------------------------------------- geometry */

function polyPoints(cx: number, cy: number, r: number, sides: number, rot = 0) {
  const p: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides - Math.PI / 2 + rot;
    p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(' ');
}

function hexLattice(color: string) {
  const out: React.ReactNode[] = [];
  const r = 11, dx = r * 1.732, dy = r * 1.5;
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      const cx = C + col * dx + (row % 2 ? dx / 2 : 0);
      const cy = C + row * dy;
      out.push(
        <Polygon key={`h${row}_${col}`} points={polyPoints(cx, cy, r - 1.6, 6, Math.PI / 6)}
          fill="none" stroke={color} strokeWidth={0.9} opacity={0.5} />
      );
    }
  }
  return out;
}

function spokes(color: string, count: number, inner: number, outer: number, w: number, op = 0.85) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    out.push(
      <Line key={`s${i}`}
        x1={C + inner * Math.cos(a)} y1={C + inner * Math.sin(a)}
        x2={C + outer * Math.cos(a)} y2={C + outer * Math.sin(a)}
        stroke={color} strokeWidth={w} strokeLinecap="round" opacity={op} />
    );
  }
  return out;
}

/** Layered rings standing in for a blur glow -- react-native-svg filter
 *  support is unreliable on Android, and this reads the same. */
function glowRing(color: string, r: number, layers = 4) {
  const out: React.ReactNode[] = [];
  for (let i = layers; i >= 1; i--) {
    out.push(
      <Circle key={`g${i}`} cx={C} cy={C} r={r + i * 2.4} fill="none"
        stroke={color} strokeWidth={i * 1.5} opacity={0.055 * (layers - i + 1)} />
    );
  }
  return out;
}

function circuitTraces(color: string) {
  const out: React.ReactNode[] = [];
  [14, 52, 96, 140, 188, 232, 276, 318].forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const midR = 26 + (i % 3) * 7, endR = 47 + (i % 2) * 6;
    const mx = C + midR * Math.cos(a), my = C + midR * Math.sin(a);
    const turn = a + (i % 2 ? 0.38 : -0.38);
    const ex = C + endR * Math.cos(turn), ey = C + endR * Math.sin(turn);
    out.push(
      <Path key={`t${i}`} d={`M${C} ${C} L${mx.toFixed(1)} ${my.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}`}
        fill="none" stroke={color} strokeWidth={1.5} opacity={0.9} />,
      <Circle key={`n${i}`} cx={ex} cy={ey} r={2.4} fill={color} />
    );
  });
  return out;
}

function traceNodes(color: string) {
  const out: React.ReactNode[] = [];
  [14, 52, 96, 140, 188, 232, 276, 318].forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const endR = 47 + (i % 2) * 6;
    const turn = a + (i % 2 ? 0.38 : -0.38);
    out.push(
      <Circle key={`b${i}`} cx={C + endR * Math.cos(turn)} cy={C + endR * Math.sin(turn)}
        r={5} fill={color} opacity={0.3} />
    );
  });
  return out;
}

/** Small geometric glyphs sitting on a ring -- four shapes cycled so the ring
 *  reads as written script rather than repeated decoration. */
function runeRing(color: string, radius: number, count: number, u: number) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    const x = C + radius * Math.cos(a), y = C + radius * Math.sin(a);
    const deg = (a * 180) / Math.PI + 90;
    const k = i % 4;
    let glyph: React.ReactNode;
    if (k === 0) glyph = <Path d={`M${-u} ${-u} L0 ${u} L${u} ${-u}`} fill="none" stroke={color} strokeWidth={1.4} />;
    else if (k === 1) glyph = <Rect x={-u * 0.7} y={-u * 0.7} width={u * 1.4} height={u * 1.4} fill="none" stroke={color} strokeWidth={1.3} />;
    else if (k === 2) glyph = <Path d={`M0 ${-u} V${u} M${-u * 0.7} 0 H${u * 0.7}`} stroke={color} strokeWidth={1.4} />;
    else glyph = <Circle r={u * 0.72} fill="none" stroke={color} strokeWidth={1.3} />;
    out.push(
      <G key={`r${i}`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(0)})`} opacity={0.9}>
        {glyph}
      </G>
    );
  }
  return out;
}

function bracketSet(color: string, r: number, len: number, w: number) {
  return [45, 135, 225, 315].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return (
      <G key={`k${deg}`} transform={`translate(${(C + r * Math.cos(a)).toFixed(1)} ${(C + r * Math.sin(a)).toFixed(1)}) rotate(${deg + 45})`}>
        <Path d={`M${-len} 0 H0 V${len}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="square" />
      </G>
    );
  });
}

/** Chunky deterministic pixel field -- seeded off grid position so a given
 *  cell always picks the same colour, no randomness to re-roll on re-render. */
function pixelField(colors: string[]) {
  const out: React.ReactNode[] = [];
  const px = 15;
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      const x = gx * px, y = gy * px;
      const dx = x + px / 2 - C, dy = y + px / 2 - C;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 60) continue;
      const seed = (gx * 7 + gy * 13 + gx * gy) % 11;
      if (seed > 5 && d < 34) continue;
      out.push(
        <Rect key={`p${gx}_${gy}`} x={x} y={y} width={px} height={px}
          fill={colors[seed % colors.length]} opacity={0.1 + (seed % 4) * 0.09} />
      );
    }
  }
  return out;
}

/* ------------------------------------------------------------ motion layer */

type Layer = {
  key: string;
  content: React.ReactNode;
  spin?: number;              // ms per full revolution
  reverse?: boolean;
  pulse?: [number, number, number];  // [fromOpacity, toOpacity, ms]
  throb?: number;             // ms for a gentle scale pulse
  drift?: { from: number; to: number; ms: number; fade?: boolean }; // vertical travel
};

type Spec = {
  base: React.ReactNode;
  layers: Layer[];
  /** Glitch draws the icon three times in offset channel colours. */
  channelSplit?: boolean;
};

function AnimLayer({ layer, size }: { layer: Layer; size: number }) {
  const spin = useSharedValue(0);
  const puls = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (layer.spin) {
      spin.value = 0;
      spin.value = withRepeat(
        withTiming(layer.reverse ? -360 : 360, { duration: layer.spin, easing: Easing.linear }), -1
      );
    }
    if (layer.pulse || layer.throb) {
      puls.value = 0;
      puls.value = withRepeat(
        withTiming(1, { duration: layer.throb ?? layer.pulse![2], easing: Easing.inOut(Easing.sin) }), -1, true
      );
    }
    if (layer.drift) {
      drift.value = 0;
      drift.value = withRepeat(
        withTiming(1, { duration: layer.drift.ms, easing: Easing.linear }), -1, false
      );
    }
  }, [layer.spin, layer.reverse, layer.throb, layer.drift?.ms]);

  const style = useAnimatedStyle(() => {
    const transform: any[] = [];
    if (layer.spin) transform.push({ rotate: `${spin.value}deg` });
    if (layer.throb) transform.push({ scale: 1 + puls.value * 0.09 });
    if (layer.drift) {
      transform.push({
        translateY: (interpolate(drift.value, [0, 1], [layer.drift.from, layer.drift.to]) / VB) * size,
      });
    }
    let opacity = 1;
    if (layer.pulse) opacity = layer.pulse[0] + puls.value * (layer.pulse[1] - layer.pulse[0]);
    // A drifting element that never fades would pop when the loop resets;
    // riding a sine over the travel hides the seam.
    if (layer.drift?.fade) opacity = Math.sin(drift.value * Math.PI);
    return { opacity, transform };
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>{layer.content}</Svg>
    </Animated.View>
  );
}

function MotionLayers({ layers, size }: { layers: Layer[]; size: number }) {
  return <>{layers.map((l) => <AnimLayer key={l.key} layer={l} size={size} />)}</>;
}

function RestLayers({ layers, size }: { layers: Layer[]; size: number }) {
  return (
    <>
      {layers.map((l) => (
        <View key={l.key} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>{l.content}</Svg>
        </View>
      ))}
    </>
  );
}

/* ------------------------------------------------------------- frame specs */

const RIM = <Circle cx={C} cy={C} r={58} fill="none" stroke="#000" strokeOpacity={0.45} strokeWidth={3} />;

function buildSpec(id: AvatarFrameId, detail: boolean): Spec {
  switch (id) {
    case 'hexforge':
      return {
        base: (
          <>
            <Defs>
              <RadialGradient id="hf" cx="38%" cy="30%">
                <Stop offset="0" stopColor="#5A6580" /><Stop offset="1" stopColor="#171B26" />
              </RadialGradient>
            </Defs>
            <Circle cx={C} cy={C} r={60} fill="url(#hf)" />
            {detail && hexLattice('#9FB0CC')}
            <Circle cx={C} cy={C} r={45} fill="none" stroke="#0C0F16" strokeWidth={7} opacity={0.55} />
            <Circle cx={C} cy={C} r={45} fill="none" stroke="#A8B8D4" strokeWidth={1.6} opacity={0.9} />
            {RIM}
          </>
        ),
        layers: [{ key: 'ticks', spin: 22000, content: <>{spokes('#C3D0E6', 24, 50, 55, 1.5)}</> }],
      };

    case 'neoncircuit':
      return {
        base: (
          <>
            <Defs>
              <RadialGradient id="nc" cx="50%" cy="50%">
                <Stop offset="0" stopColor="#0F2A38" /><Stop offset="1" stopColor="#04070E" />
              </RadialGradient>
            </Defs>
            <Circle cx={C} cy={C} r={60} fill="url(#nc)" />
            {detail && circuitTraces('#22D3EE')}
            {glowRing('#22D3EE', 40)}
            <Circle cx={C} cy={C} r={41} fill="none" stroke="#22D3EE" strokeWidth={1.5} opacity={0.55} />
            <Circle cx={C} cy={C} r={56} fill="none" stroke="#E879F9" strokeWidth={2.2} opacity={0.75} />
            {RIM}
          </>
        ),
        // Without SVG filters, "current arriving" reads better as the terminal
        // nodes blooming than as anything happening along the traces.
        layers: [{ key: 'nodes', pulse: [0.25, 1, 1500], content: <>{traceNodes('#67E8F9')}</> }],
      };

    case 'sunburst':
      return {
        base: (
          <>
            <Defs>
              <RadialGradient id="sb" cx="50%" cy="42%">
                <Stop offset="0" stopColor="#7E1220" /><Stop offset="1" stopColor="#2B0509" />
              </RadialGradient>
            </Defs>
            <Circle cx={C} cy={C} r={60} fill="url(#sb)" />
          </>
        ),
        layers: [
          { key: 'gold', spin: 22000, content: <>{spokes('#F5C542', 20, 20, 58, 3.4)}</> },
          { key: 'light', spin: 17000, reverse: true, content: <>{spokes('#FFE9A8', 20, 44, 52, 1.3)}</> },
          {
            key: 'disc', content: (
              <>
                <Circle cx={C} cy={C} r={38} fill="#33060C" opacity={0.88} />
                <Circle cx={C} cy={C} r={38} fill="none" stroke="#F5C542" strokeWidth={2.1} />
                <Circle cx={C} cy={C} r={56} fill="none" stroke="#F5C542" strokeWidth={2.8} opacity={0.9} />
                {RIM}
              </>
            ),
          },
        ],
      };

    case 'voidorbit': {
      const motes = [0, 47, 96, 152, 205, 260, 310].map((deg, i) => {
        const a = (deg * Math.PI) / 180, r = 46 + (i % 3) * 5;
        return <Circle key={`m${i}`} cx={C + r * Math.cos(a)} cy={C + r * Math.sin(a)}
          r={1.5 + (i % 3) * 0.9} fill="#BFD9FF" opacity={0.6 + (i % 2) * 0.35} />;
      });
      return {
        base: (
          <>
            <Defs>
              <RadialGradient id="vo" cx="42%" cy="36%">
                <Stop offset="0" stopColor="#3B2C7A" /><Stop offset="0.55" stopColor="#120C2E" /><Stop offset="1" stopColor="#05030F" />
              </RadialGradient>
            </Defs>
            <Circle cx={C} cy={C} r={60} fill="url(#vo)" />
            {glowRing('#7FE6FF', 41)}
            <Circle cx={C} cy={C} r={56} fill="none" stroke="#8B7BEA" strokeWidth={2} opacity={0.8} />
            {RIM}
          </>
        ),
        layers: [
          { key: 'halo', pulse: [0.2, 0.55, 3400], content: <Circle cx={C} cy={C} r={40} fill="#6C3EFF" /> },
          {
            key: 'orbit', spin: 17000, reverse: true, content: (
              <>
                <Ellipse cx={C} cy={C} rx={49} ry={21} fill="none" stroke="#7FE6FF" strokeWidth={1.3}
                  opacity={0.55} transform={`rotate(-24 ${C} ${C})`} />
                {motes}
              </>
            ),
          },
        ],
      };
    }

    case 'runesigil':
      return {
        base: (
          <>
            <Defs>
              <RadialGradient id="rs" cx="50%" cy="50%">
                <Stop offset="0" stopColor="#3B1D6E" /><Stop offset="0.6" stopColor="#170A2E" /><Stop offset="1" stopColor="#08030F" />
              </RadialGradient>
            </Defs>
            <Circle cx={C} cy={C} r={60} fill="url(#rs)" />
            {glowRing('#A855F7', 44)}
            <Circle cx={C} cy={C} r={56} fill="none" stroke="#C084FC" strokeWidth={2.2} opacity={0.85} />
            {RIM}
          </>
        ),
        layers: [
          { key: 'core', throb: 2400, content: <Circle cx={C} cy={C} r={26} fill="#A855F7" opacity={0.28} /> },
          {
            key: 'outer', spin: 22000, content: (
              <>
                {detail && runeRing('#E9D5FF', 52, 16, 3.4)}
                <Circle cx={C} cy={C} r={46} fill="none" stroke="#C084FC" strokeWidth={1} opacity={0.6} />
              </>
            ),
          },
          {
            key: 'inner', spin: 9000, reverse: true, content: (
              <>
                {detail && runeRing('#F5C542', 38, 8, 3)}
                <Circle cx={C} cy={C} r={32} fill="none" stroke="#F5C542" strokeWidth={1.2} opacity={0.75} />
              </>
            ),
          },
          {
            key: 'tri', spin: 13000, content: (
              <>
                <Polygon points={polyPoints(C, C, 24, 3, 0)} fill="none" stroke="#E9D5FF" strokeWidth={1.3} opacity={0.8} />
                <Polygon points={polyPoints(C, C, 24, 3, Math.PI)} fill="none" stroke="#E9D5FF" strokeWidth={1.3} opacity={0.8} />
              </>
            ),
          },
        ],
      };

    case 'glitch': {
      const bands: React.ReactNode[] = [];
      for (let i = 0; i < 12; i++) {
        bands.push(<Rect key={`b${i}`} x={0} y={i * 13} width={VB} height={4} fill="#E2FFF4" opacity={0.05 + (i % 3) * 0.045} />);
      }
      return {
        channelSplit: true,
        base: (
          <>
            <Circle cx={C} cy={C} r={60} fill="#050409" />
            {detail && (
              <>
                <Rect x={14} y={30} width={40} height={6} fill="#00F0C8" opacity={0.38} />
                <Rect x={58} y={74} width={30} height={4} fill="#FF2E88" opacity={0.38} />
                <Rect x={26} y={96} width={52} height={5} fill="#00F0C8" opacity={0.38} />
              </>
            )}
            <Circle cx={C} cy={C} r={56} fill="none" stroke="#00F0C8" strokeWidth={2} opacity={0.8} />
            <Circle cx={C} cy={C} r={51} fill="none" stroke="#FF2E88" strokeWidth={1.1} opacity={0.55} />
            {RIM}
          </>
        ),
        // 13 = the band spacing, so the loop reset lands exactly on the next
        // band and the roll reads as continuous.
        layers: [{ key: 'scan', drift: { from: 0, to: 13, ms: 2200 }, content: <>{bands}</> }],
      };
    }

    case 'lockon':
      return {
        base: (
          <>
            <Defs>
              <RadialGradient id="lo" cx="50%" cy="50%">
                <Stop offset="0" stopColor="#12211C" /><Stop offset="1" stopColor="#040806" />
              </RadialGradient>
              <LinearGradient id="lw" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#4ADE80" stopOpacity={0.55} />
                <Stop offset="1" stopColor="#4ADE80" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Circle cx={C} cy={C} r={60} fill="url(#lo)" />
            <Circle cx={C} cy={C} r={46} fill="none" stroke="#4ADE80" strokeWidth={0.9} opacity={0.45} />
            <Circle cx={C} cy={C} r={31} fill="none" stroke="#4ADE80" strokeWidth={0.9} opacity={0.45} />
            <Path d="M60 6 V20 M60 100 V114 M6 60 H20 M100 60 H114" stroke="#4ADE80" strokeWidth={1.5} opacity={0.8} />
            <Circle cx={C} cy={C} r={56} fill="none" stroke="#4ADE80" strokeWidth={2} opacity={0.8} />
            {RIM}
          </>
        ),
        layers: [
          { key: 'sweep', spin: 6000, content: <Path d={`M${C} ${C} L120 60 A60 60 0 0 0 92 8 Z`} fill="url(#lw)" /> },
          { key: 'ticks', spin: 13000, content: <>{spokes('#86EFAC', 32, 51, 56, 1.2)}</> },
          { key: 'brackets', throb: 2400, content: <>{bracketSet('#F87171', 40, 11, 2.6)}</> },
        ],
      };

    case 'hyperdrive': {
      const streaks: React.ReactNode[] = [];
      for (let i = 0; i < 18; i++) {
        const a = (Math.PI * 2 * i) / 18 + (i % 2 ? 0.09 : 0);
        const len = 20 + (i % 4) * 9;
        streaks.push(
          <Line key={`k${i}`}
            x1={C + 24 * Math.cos(a)} y1={C + 24 * Math.sin(a)}
            x2={C + (24 + len) * Math.cos(a)} y2={C + (24 + len) * Math.sin(a)}
            stroke="#BAE6FD" strokeWidth={1.4 + (i % 3) * 0.7} strokeLinecap="round" />
        );
      }
      return {
        base: (
          <>
            <Defs>
              <RadialGradient id="hy" cx="50%" cy="50%">
                <Stop offset="0" stopColor="#DDF4FF" /><Stop offset="0.24" stopColor="#1D5FA8" /><Stop offset="1" stopColor="#040A16" />
              </RadialGradient>
            </Defs>
            <Circle cx={C} cy={C} r={60} fill="url(#hy)" />
            {glowRing('#7DD3FC', 43)}
            <Circle cx={C} cy={C} r={56} fill="none" stroke="#7DD3FC" strokeWidth={2.2} opacity={0.85} />
            {RIM}
          </>
        ),
        // Per-streak stagger would need one shared value each; pulsing the
        // whole field together costs one and still reads as thrust.
        layers: [
          { key: 'streaks', throb: 1900, pulse: [0.35, 1, 1900], content: <>{streaks}</> },
          { key: 'core', pulse: [0.3, 0.75, 3400], content: <Circle cx={C} cy={C} r={22} fill="#E0F2FE" /> },
        ],
      };
    }

    case 'toxic': {
      const bubbles = [[38, 84, 3.4], [52, 96, 2.2], [70, 88, 4.1], [84, 100, 2.6], [30, 100, 2], [62, 78, 2.8]];
      const trefoil = [0, 120, 240].map((deg) => (
        <Path key={`f${deg}`} d="M60 60 m0 -34 a34 34 0 0 1 29.4 17 L60 60 Z" fill="#A3E635"
          opacity={0.16} transform={`rotate(${deg} ${C} ${C})`} />
      ));
      return {
        base: (
          <>
            <Defs>
              <RadialGradient id="tv" cx="50%" cy="62%">
                <Stop offset="0" stopColor="#4D7C0F" /><Stop offset="0.5" stopColor="#1A2E05" /><Stop offset="1" stopColor="#060B02" />
              </RadialGradient>
            </Defs>
            <Circle cx={C} cy={C} r={60} fill="url(#tv)" />
            {detail && trefoil}
            <Circle cx={C} cy={C} r={44} fill="none" stroke="#65A30D" strokeWidth={6} opacity={0.5} />
            <Circle cx={C} cy={C} r={44} fill="none" stroke="#D9F99D" strokeWidth={1.3} opacity={0.8} />
            <Circle cx={C} cy={C} r={56} fill="none" stroke="#A3E635" strokeWidth={2.4} opacity={0.85} />
            {RIM}
          </>
        ),
        layers: [
          { key: 'glow', pulse: [0.16, 0.44, 3400], content: <Circle cx={C} cy={C} r={30} fill="#A3E635" /> },
          {
            key: 'bubbles', drift: { from: 16, to: -46, ms: 3600, fade: true },
            content: <>{bubbles.map((b, i) => <Circle key={`u${i}`} cx={b[0]} cy={b[1]} r={b[2]} fill="#D9F99D" />)}</>,
          },
        ],
      };
    }

    case 'pixel': {
      const lines: React.ReactNode[] = [];
      for (let i = 0; i < 14; i++) {
        lines.push(<Rect key={`l${i}`} x={0} y={i * 9} width={VB} height={3} fill="#000" opacity={0.3} />);
      }
      return {
        base: (
          <>
            <Circle cx={C} cy={C} r={60} fill="#160B22" />
            {detail && pixelField(['#FF3CAC', '#37F3FF', '#FFE66D', '#7B61FF', '#00E676'])}
            <Circle cx={C} cy={C} r={38} fill="#0D0518" opacity={0.82} />
            <Circle cx={C} cy={C} r={38} fill="none" stroke="#37F3FF" strokeWidth={1.6} opacity={0.85} />
            <Circle cx={C} cy={C} r={56} fill="none" stroke="#FF3CAC" strokeWidth={2.4} opacity={0.9} />
            {RIM}
          </>
        ),
        layers: [{ key: 'scan', drift: { from: 0, to: 9, ms: 1800 }, content: <>{lines}</> }],
      };
    }
  }
}

/* ------------------------------------------------------------------ export */

export default function AvatarFrame({ frameId, size, animated = false, renderIcon }: Props) {
  const meta = getAvatarFrame(frameId);

  // Fine detail (lattices, pixel fields, rune glyphs) turns to noise once the
  // avatar is small enough that a stroke is under a pixel, so drop it there
  // rather than paying to draw something illegible.
  const detail = size >= 40;

  // A frame is 30-60 SVG elements. Rebuilding that on every render would be
  // paid once per visible row per scroll frame in the lists that show avatars.
  const spec = useMemo(() => (meta ? buildSpec(meta.id, detail) : null), [meta?.id, detail]);

  if (!meta || !spec) return <>{renderIcon('#fff')}</>;

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>{spec.base}</Svg>
      </View>

      {/* Keyed by frame so switching frames remounts rather than changing how
          many hooks AnimLayer renders across a single component's life. */}
      {animated
        ? <MotionLayers key={meta.id} layers={spec.layers} size={size} />
        : <RestLayers key={meta.id} layers={spec.layers} size={size} />}

      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        {spec.channelSplit ? (
          <>
            <View style={[styles.ghost, { transform: [{ translateX: -size * 0.025 }, { translateY: size * 0.01 }] }]}>
              {renderIcon('#FF2E88')}
            </View>
            <View style={[styles.ghost, { transform: [{ translateX: size * 0.025 }, { translateY: -size * 0.01 }] }]}>
              {renderIcon('#00F0C8')}
            </View>
            {renderIcon(meta.ink)}
          </>
        ) : renderIcon(meta.ink)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  ghost: { position: 'absolute', opacity: 0.85, justifyContent: 'center', alignItems: 'center' },
});
