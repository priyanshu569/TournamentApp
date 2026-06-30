import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getUnreadCount } from '@/lib/notifications';

export default function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

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
  }

  return (
    <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/notifications')}>
      <Text style={styles.notifIcon}>🔔</Text>
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  notifBtn: { padding: 8, position: 'relative' },
  notifIcon: { fontSize: 22 },
  badge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: '#FF4655', borderRadius: 9,
    minWidth: 18, height: 18, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});