import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  colors: readonly [string, string, ...string[]];
  iconColor?: string;
  glowColor?: string;
};

export default function GradientIconBadge({ icon, size = 52, colors, iconColor = '#fff', glowColor }: Props) {
  const iconSize = Math.round(size * 0.44);

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, shadowColor: glowColor ?? colors[colors.length - 1] }]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <View
          style={[
            styles.shine,
            {
              width: size * 0.55, height: size * 0.38,
              borderRadius: size * 0.3,
              top: size * 0.05, left: size * 0.08,
            },
          ]}
        />
        <Ionicons name={icon} size={iconSize} color={iconColor} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
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
    backgroundColor: '#ffffff33',
    transform: [{ rotate: '-20deg' }],
  },
});
