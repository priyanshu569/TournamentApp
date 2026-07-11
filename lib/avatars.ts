export type AvatarPreset = {
  id: string;
  label: string;
  iconFamily: 'ionicons' | 'material-community';
  iconName: string;
  colors: [string, string];
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'flame', label: 'Flame', iconFamily: 'ionicons', iconName: 'flame', colors: ['#FF6B35', '#FF3D00'] },
  { id: 'lightning', label: 'Lightning', iconFamily: 'ionicons', iconName: 'flash', colors: ['#A342FA', '#6A19D0'] },
  { id: 'skull', label: 'Skull', iconFamily: 'material-community', iconName: 'skull', colors: ['#444444', '#111111'] },
  { id: 'controller', label: 'Controller', iconFamily: 'ionicons', iconName: 'game-controller', colors: ['#00D4AA', '#00897B'] },
  { id: 'headset', label: 'Headset', iconFamily: 'ionicons', iconName: 'headset', colors: ['#FFB800', '#FF8F00'] },
  { id: 'crosshair', label: 'Crosshair', iconFamily: 'material-community', iconName: 'crosshairs-gps', colors: ['#FF4655', '#C62828'] },
  { id: 'trophy', label: 'Trophy', iconFamily: 'ionicons', iconName: 'trophy', colors: ['#FFD700', '#FFA000'] },
  { id: 'ghost', label: 'Ghost', iconFamily: 'material-community', iconName: 'ghost', colors: ['#546E7A', '#263238'] },
];

export function getAvatarPreset(avatarId: string | null | undefined): AvatarPreset | null {
  if (!avatarId) return null;
  return AVATAR_PRESETS.find((a) => a.id === avatarId) ?? null;
}
