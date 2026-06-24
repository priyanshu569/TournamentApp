import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <View style={styles.badge}>
      <Ionicons name="checkmark-circle" size={size} color="#7C3AED" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { marginLeft: 4 },
});