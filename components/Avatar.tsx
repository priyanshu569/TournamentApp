import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAvatarPreset } from '@/lib/avatars';
import AvatarFrame from './AvatarFrame';

type Props = {
  avatarId?: string | null;
  avatarUrl?: string | null;
  /** Decorated backdrop the icon sits on. Null keeps the original flat look,
   *  so profiles saved before frames existed render exactly as they did. */
  frameId?: string | null;
  username?: string | null;
  size?: number;
  /** Opt in to frame motion. Off by default because avatars render inside
   *  FlatLists on most screens -- only profile-scale ones should animate. */
  animated?: boolean;
};

export default function Avatar({ avatarId, avatarUrl, frameId, username, size = 64, animated = false }: Props) {
  const preset = getAvatarPreset(avatarId);
  const iconSize = Math.round(size * 0.52);

  // An uploaded photo is the whole avatar -- there's nothing for a frame to sit
  // behind, so it wins outright.
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  if (frameId) {
    return (
      <AvatarFrame
        frameId={frameId}
        size={size}
        animated={animated}
        renderIcon={(color) => {
          if (preset) {
            const IconComponent = preset.iconFamily === 'ionicons' ? Ionicons : MaterialCommunityIcons;
            return <IconComponent name={preset.iconName as any} size={iconSize} color={color} />;
          }
          return (
            <Text style={[styles.initialsText, { fontSize: Math.round(size * 0.32), color }]}>
              {username?.slice(0, 2).toUpperCase() ?? 'NA'}
            </Text>
          );
        }}
      />
    );
  }

  if (preset) {
    const IconComponent = preset.iconFamily === 'ionicons' ? Ionicons : MaterialCommunityIcons;
    return (
      <LinearGradient
        colors={preset.colors}
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <IconComponent name={preset.iconName as any} size={iconSize} color="#fff" />
      </LinearGradient>
    );
  }

  const initials = username?.slice(0, 2).toUpperCase() ?? 'NA';
  return (
    <View style={[styles.circle, styles.initialsCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initialsText, { fontSize: Math.round(size * 0.36) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center' },
  initialsCircle: { backgroundColor: '#7C3AED' },
  initialsText: { color: '#fff', fontWeight: '800' },
});
