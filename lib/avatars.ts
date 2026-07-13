export type AvatarPreset = {
  id: string;
  label: string;
  iconFamily: 'ionicons' | 'material-community';
  iconName: string;
  colors: [string, string];
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  // Original 8 — general esports vibe
  { id: 'skull', label: 'Skull', iconFamily: 'material-community', iconName: 'skull', colors: ['#444444', '#111111'] },
  { id: 'controller', label: 'Controller', iconFamily: 'ionicons', iconName: 'game-controller', colors: ['#00D4AA', '#00897B'] },
  { id: 'headset', label: 'Headset', iconFamily: 'ionicons', iconName: 'headset', colors: ['#FFB800', '#FF8F00'] },
  { id: 'crosshair', label: 'Crosshair', iconFamily: 'material-community', iconName: 'crosshairs-gps', colors: ['#FF4655', '#C62828'] },
  { id: 'ghost', label: 'Ghost', iconFamily: 'material-community', iconName: 'ghost', colors: ['#546E7A', '#263238'] },

  // Cute / soft
  { id: 'heart', label: 'Heart', iconFamily: 'ionicons', iconName: 'heart', colors: ['#FF6FA5', '#FF3D81'] },
  { id: 'flower', label: 'Flower', iconFamily: 'material-community', iconName: 'flower', colors: ['#F78FB3', '#EE5A9E'] },
  { id: 'unicorn', label: 'Unicorn', iconFamily: 'material-community', iconName: 'unicorn-variant', colors: ['#C084FC', '#A855F7'] },

  // Warrior / dangerous
  { id: 'swordcross', label: 'Crossed Swords', iconFamily: 'material-community', iconName: 'sword-cross', colors: ['#90A4AE', '#37474F'] },

  // Calm
  { id: 'meditation', label: 'Meditation', iconFamily: 'material-community', iconName: 'meditation', colors: ['#4FC3F7', '#0288D1'] },
];

export function getAvatarPreset(avatarId: string | null | undefined): AvatarPreset | null {
  if (!avatarId) return null;
  return AVATAR_PRESETS.find((a) => a.id === avatarId) ?? null;
}
