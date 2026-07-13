import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type Props = { size?: number };

export default function LeaderboardIcon({ size = 36 }: Props) {
  const iconSize = Math.round(size * 0.52);

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={['#FFE484', '#FFB800', '#B8860B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <View
          style={[
            styles.shine,
            {
              width: size * 0.55, height: size * 0.4,
              borderRadius: size * 0.3,
              top: size * 0.04, left: size * 0.08,
            },
          ]}
        />
        <Ionicons name="trophy" size={iconSize} color="#4a2e00" />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 6,
  },
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    backgroundColor: '#ffffff4d',
    transform: [{ rotate: '-20deg' }],
  },
});
