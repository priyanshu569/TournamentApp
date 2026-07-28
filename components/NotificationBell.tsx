import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withTiming,
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { getUnreadCount } from '@/lib/notifications';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function NotificationBell() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [unread, setUnread] = useState(0);
  const rotation = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      loadCount();
    }, [])
  );

  async function loadCount() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const count = await getUnreadCount(userData.user.id);
    setUnread(count);

    if (count > 0) {
      rotation.value = withSequence(
        withTiming(-18, { duration: 90 }),
        withTiming(16, { duration: 130 }),
        withTiming(-10, { duration: 110 }),
        withTiming(6, { duration: 90 }),
        withTiming(0, { duration: 90 }),
      );
    }
  }

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const hasUnread = unread > 0;

  return (
    <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/notifications')} activeOpacity={0.8}>
      <LinearGradient
        colors={hasUnread ? ['#7C3AED', '#4C1D95'] : ['#1a1a1a', '#1a1a1a']}
        style={[styles.circle, !hasUnread && styles.circleIdle]}
      >
        <Animated.View style={ringStyle}>
          <Ionicons
            name={hasUnread ? 'notifications' : 'notifications-outline'}
            size={18}
            color={hasUnread ? '#fff' : colors.textTertiary}
          />
        </Animated.View>
      </LinearGradient>

      {hasUnread && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    notifBtn: { padding: 4, position: 'relative' },
    circle: {
      width: 36, height: 36, borderRadius: 18,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.45, shadowRadius: 8, elevation: 5,
    },
    circleIdle: {
      borderWidth: 1, borderColor: colors.border,
      shadowOpacity: 0, elevation: 0,
    },
    badge: {
      position: 'absolute', top: 0, right: 0,
      backgroundColor: '#FF4655', borderRadius: 9,
      minWidth: 18, height: 18, justifyContent: 'center',
      alignItems: 'center', paddingHorizontal: 4,
      borderWidth: 1.5, borderColor: colors.background,
      shadowColor: '#FF4655', shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7, shadowRadius: 4, elevation: 4,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  });
}
