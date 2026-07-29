import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <LinearGradient
      colors={['#8B5CF6', '#6D28D9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Ionicons name="checkmark-sharp" size={Math.round(size * 0.62)} color="#fff" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: {
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5, shadowRadius: 3, elevation: 2,
  },
});
