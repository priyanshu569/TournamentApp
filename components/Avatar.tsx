import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAvatarPreset } from '@/lib/avatars';

type Props = {
  avatarId?: string | null;
  avatarUrl?: string | null;
  username?: string | null;
  size?: number;
};

export default function Avatar({ avatarId, avatarUrl, username, size = 64 }: Props) {
  const preset = getAvatarPreset(avatarId);
  const iconSize = Math.round(size * 0.52);

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
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
