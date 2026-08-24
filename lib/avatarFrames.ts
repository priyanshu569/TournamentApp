// Avatar frames -- the decorated backdrop an avatar icon sits on.
//
// Frames are deliberately separate from AVATAR_PRESETS (the icon itself):
// a player picks an icon and a frame independently, so 10 frames x 10 icons
// covers 100 looks without hand-authoring 100 of anything. It also means the
// existing avatar_id values keep working untouched -- a profile with no frame
// selected renders exactly as it did before.

export type AvatarFrameId =
  | 'hexforge'
  | 'neoncircuit'
  | 'sunburst'
  | 'voidorbit'
  | 'runesigil'
  | 'glitch'
  | 'lockon'
  | 'hyperdrive'
  | 'toxic'
  | 'pixel';

export type AvatarFrameMeta = {
  id: AvatarFrameId;
  label: string;
  description: string;
  /** Colour the icon is drawn in so it stays legible against this frame. */
  ink: string;
  /** Swatch colours for the picker chip, dark -> light. */
  swatch: [string, string];
};

export const AVATAR_FRAMES: AvatarFrameMeta[] = [
  {
    id: 'hexforge',
    label: 'Hex Forge',
    description: 'Honeycomb lattice under brushed steel',
    ink: '#EDF2FA',
    swatch: ['#171B26', '#5A6580'],
  },
  {
    id: 'neoncircuit',
    label: 'Neon Circuit',
    description: 'Circuit traces feeding lit terminal nodes',
    ink: '#A5F3FC',
    swatch: ['#04070E', '#22D3EE'],
  },
  {
    id: 'sunburst',
    label: 'Sunburst Crest',
    description: 'Heraldic gold spokes on deep crimson',
    ink: '#FFE9A8',
    swatch: ['#2B0509', '#F5C542'],
  },
  {
    id: 'voidorbit',
    label: 'Void Orbit',
    description: 'Deep space with drifting orbital motes',
    ink: '#DDE9FF',
    swatch: ['#05030F', '#7FE6FF'],
  },
  {
    id: 'runesigil',
    label: 'Rune Sigil',
    description: 'Counter-rotating glyph rings and arcane core',
    ink: '#F5EBFF',
    swatch: ['#08030F', '#C084FC'],
  },
  {
    id: 'glitch',
    label: 'Glitch Protocol',
    description: 'Split colour channels and rolling scanlines',
    ink: '#F2FBFF',
    swatch: ['#050409', '#FF2E88'],
  },
  {
    id: 'lockon',
    label: 'Lock-On',
    description: 'Targeting reticle with a sweeping radar wedge',
    ink: '#DCFCE7',
    swatch: ['#040806', '#4ADE80'],
  },
  {
    id: 'hyperdrive',
    label: 'Hyperdrive',
    description: 'Light-speed streaks firing outward',
    ink: '#F0F9FF',
    swatch: ['#040A16', '#7DD3FC'],
  },
  {
    id: 'toxic',
    label: 'Toxic Vault',
    description: 'Acid pool with rising bubbles',
    ink: '#ECFCCB',
    swatch: ['#060B02', '#A3E635'],
  },
  {
    id: 'pixel',
    label: 'Pixel Arcade',
    description: 'CRT phosphor pixels behind rolling scanlines',
    ink: '#FFE66D',
    swatch: ['#160B22', '#37F3FF'],
  },
];

export function getAvatarFrame(id: string | null | undefined): AvatarFrameMeta | null {
  if (!id) return null;
  return AVATAR_FRAMES.find((f) => f.id === id) ?? null;
}
