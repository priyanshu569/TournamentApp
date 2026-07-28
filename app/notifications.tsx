import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, SectionList,
  TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

function getNotificationMeta(title: string, colors: ThemeColors): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  const t = title.toLowerCase();
  if (t.includes('confirmed') || t.includes('payment')) return { icon: 'checkmark-circle', color: colors.success };
  if (t.includes('room code')) return { icon: 'key', color: colors.warning };
  if (t.includes('host')) return { icon: 'trophy', color: '#FF6B35' };
  if (t.includes('cancel') || t.includes('failed') || t.includes('rejected')) return { icon: 'close-circle', color: colors.error };
  if (t.includes('tournament') || t.includes('update')) return { icon: 'megaphone', color: colors.accent };
  return { icon: 'notifications', color: colors.accent };
}

function dayBucket(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'This Week';
  return 'Earlier';
}

const BUCKET_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier'];

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  async function loadNotifications() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false });

    if (data) setNotifications(data);
    setLoading(false);
    setRefreshing(false);

    const unreadIds = (data ?? []).filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds);
    }
  }

  async function handleDelete(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      console.log('Failed to delete notification:', error.message);
      loadNotifications();
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadNotifications();
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  const sections = BUCKET_ORDER
    .map((title) => ({
      title,
      data: notifications.filter((n) => dayBucket(n.created_at) === title),
    }))
    .filter((s) => s.data.length > 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-outline" size={28} color={colors.textDisabled} />
            </View>
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const meta = getNotificationMeta(item.title, colors);
          return (
            <TouchableOpacity
              style={[styles.card, !item.is_read && styles.cardUnread]}
              onPress={() => {
                if (item.tournament_id) {
                  router.push(`/tournament-details?id=${item.tournament_id}`);
                }
              }}
            >
              <View style={[styles.iconCircle, { backgroundColor: meta.color + '22' }]}>
                <Ionicons name={meta.icon} size={18} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.body}</Text>
                <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={colors.textFaint} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingHorizontal: 24,
      paddingTop: 60, paddingBottom: 16,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
    listContent: { padding: 24, paddingTop: 8 },
    sectionHeader: {
      color: colors.textMuted, fontSize: 12, fontWeight: '800',
      letterSpacing: 1, marginBottom: 10, marginTop: 12,
    },
    emptyContainer: { alignItems: 'center', marginTop: 80 },
    emptyIconCircle: {
      width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center', marginBottom: 16,
      borderWidth: 1, borderColor: colors.border,
    },
    emptyText: { color: colors.textFaint, fontSize: 14 },
    card: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      backgroundColor: colors.surface, borderRadius: 14,
      padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    cardUnread: { borderColor: colors.accent },
    iconCircle: {
      width: 36, height: 36, borderRadius: 18,
      justifyContent: 'center', alignItems: 'center',
    },
    cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
    cardBody: { color: colors.textSecondary, fontSize: 13, marginBottom: 6 },
    cardTime: { color: colors.textFaint, fontSize: 11 },
    deleteBtn: { padding: 2 },
  });
}
