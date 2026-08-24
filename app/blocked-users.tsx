import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import { useAvatarPreview } from '@/lib/AvatarPreviewContext';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const showAvatarPreview = useAvatarPreview();
  const [blocked, setBlocked] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id ?? null;
    setMyId(me);
    if (!me) { setLoading(false); return; }

    const { data: blocks } = await supabase
      .from('blocks')
      .select('id, blocked_id, created_at')
      .eq('blocker_id', me)
      .order('created_at', { ascending: false });

    const blockedIds = (blocks ?? []).map((b: any) => b.blocked_id);
    const { data: profiles } = blockedIds.length > 0
      ? await supabase.from('public_profiles').select('id, username, display_name, avatar_id, avatar_frame, avatar_url').in('id', blockedIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setBlocked((blocks ?? []).map((b: any) => ({ ...b, profile: profileMap.get(b.blocked_id) ?? null })));
    setLoading(false);
  }

  function confirmUnblock(item: any) {
    Alert.alert(
      'Unblock this account?',
      `${item.profile?.display_name ?? 'This person'} will be able to message and interact with you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: () => handleUnblock(item) },
      ]
    );
  }

  async function handleUnblock(item: any) {
    if (!myId) return;
    setActingId(item.blocked_id);
    const { error } = await supabase.from('blocks').delete().eq('blocker_id', myId).eq('blocked_id', item.blocked_id);
    setActingId(null);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setBlocked((prev) => prev.filter((b) => b.blocked_id !== item.blocked_id));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Accounts</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={32} color={colors.textDisabled} />
              <Text style={styles.emptyText}>You haven't blocked anyone.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity
                activeOpacity={1}
                onLongPress={() => showAvatarPreview({ avatarId: item.profile?.avatar_id, avatarUrl: item.profile?.avatar_url, username: item.profile?.display_name })}
              >
                <Avatar avatarId={item.profile?.avatar_id} avatarUrl={item.profile?.avatar_url} username={item.profile?.display_name} size={44} />
              </TouchableOpacity>
              <View style={styles.rowInfo}>
                <Text style={styles.displayName} numberOfLines={1}>{item.profile?.display_name ?? 'Unknown'}</Text>
                {item.profile?.username && <Text style={styles.handle}>@{item.profile.username}</Text>}
              </View>
              <TouchableOpacity
                style={styles.unblockBtn}
                onPress={() => confirmUnblock(item)}
                disabled={actingId === item.blocked_id}
              >
                {actingId === item.blocked_id
                  ? <ActivityIndicator size="small" color={colors.accent} />
                  : <Text style={styles.unblockBtnText}>Unblock</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    listContent: { padding: 24, paddingTop: 0 },
    emptyContainer: { alignItems: 'center', gap: 12, marginTop: 60, paddingHorizontal: 20 },
    emptyText: { color: colors.textFaint, textAlign: 'center' },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 14, padding: 12,
      marginBottom: 10, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    rowInfo: { flex: 1 },
    displayName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    handle: { color: colors.textTertiary, fontSize: 12, marginTop: 2, fontWeight: '600' },
    unblockBtn: {
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, minWidth: 84, alignItems: 'center',
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    unblockBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  });
}
