import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function AdminBadge({ size = 14 }: { size?: number }) {
  return (
    <LinearGradient
      colors={['#FFE28A', '#F5B93D', '#B8860B']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Ionicons name="star" size={Math.round(size * 0.58)} color="#fff" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: {
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#B8860B', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6, shadowRadius: 4, elevation: 3,
  },
});
