import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, FlatList, RefreshControl, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import VerifiedBadge from '@/components/VerifiedBadge';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function FollowListScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: 'followers' | 'following' }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [people, setPeople] = useState<any[]>([]);
  const [canView, setCanView] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => { loadList(); }, [id, type]);

  async function onRefresh() {
    setRefreshing(true);
    await loadList();
    setRefreshing(false);
  }

  async function loadList() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id ?? null;
    setMyId(me);

    const { data: target } = await supabase
      .from('public_profiles')
      .select('follow_list_private')
      .eq('id', id)
      .single();

    let isAdmin = false;
    if (me) {
      const { data: myProfile } = await supabase
        .from('Profiles')
        .select('is_admin')
        .eq('id', me)
        .single();
      isAdmin = !!myProfile?.is_admin;
    }

    const allowed = !target?.follow_list_private || me === id || isAdmin;
    setCanView(allowed);

    if (!allowed) {
      setLoading(false);
      return;
    }

    const column = type === 'followers' ? 'following_id' : 'follower_id';
    const otherColumn = type === 'followers' ? 'follower_id' : 'following_id';

    const { data: rows } = await supabase
      .from('follows')
      .select(otherColumn)
      .eq(column, id);

    const otherIds = (rows ?? []).map((r: any) => r[otherColumn]);

    if (otherIds.length === 0) {
      setPeople([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('id, username, display_name, avatar_id, avatar_frame, avatar_url, is_verified')
      .in('id', otherIds);

    let iFollowSet = new Set<string>();
    let followsMeSet = new Set<string>();
    if (me) {
      const { data: myFollowing } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', me);
      const { data: myFollowers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', me);
      iFollowSet = new Set((myFollowing ?? []).map((r: any) => r.following_id));
      followsMeSet = new Set((myFollowers ?? []).map((r: any) => r.follower_id));
    }

    const withRelationships = (profiles ?? []).map((p: any) => ({
      ...p,
      iFollow: iFollowSet.has(p.id),
      followsMe: followsMeSet.has(p.id),
    }));

    setPeople(withRelationships);
    setLoading(false);
  }

  async function toggleFollow(personId: string, currentlyFollowing: boolean) {
    if (!myId) return;
    setActingId(personId);

    if (currentlyFollowing) {
      await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', personId);
      setPeople((prev) => prev.map((p) => (p.id === personId ? { ...p, iFollow: false } : p)));
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: myId, following_id: personId });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setPeople((prev) => prev.map((p) => (p.id === personId ? { ...p, iFollow: true } : p)));
      }
    }

    setActingId(null);
  }

  async function handleMessage(personId: string) {
    setActingId(personId);
    const { data: conversationId, error } = await supabase.rpc('start_direct_conversation', {
      other_user_id: personId,
    });
    setActingId(null);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    router.push(`/chat-thread?id=${conversationId}`);
  }

  function renderActionButton(item: any) {
    if (item.id === myId) return null;
    const isActing = actingId === item.id;

    if (item.iFollow && item.followsMe) {
      return (
        <TouchableOpacity
          style={styles.actionBtnOutline}
          onPress={(e) => { e.stopPropagation(); handleMessage(item.id); }}
          disabled={isActing}
        >
          {isActing
            ? <ActivityIndicator size="small" color={colors.accent} />
            : <Text style={styles.actionBtnOutlineText}>Message</Text>
          }
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.actionBtn, item.iFollow && styles.actionBtnActive]}
        onPress={(e) => { e.stopPropagation(); toggleFollow(item.id, item.iFollow); }}
        disabled={isActing}
      >
        {isActing
          ? <ActivityIndicator size="small" color={item.iFollow ? colors.accent : '#fff'} />
          : (
            <Text style={[styles.actionBtnText, item.iFollow && styles.actionBtnTextActive]}>
              {item.iFollow ? 'Following' : (item.followsMe ? 'Follow Back' : 'Follow')}
            </Text>
          )
        }
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{type === 'followers' ? 'Followers' : 'Following'}</Text>
        <TouchableOpacity onPress={() => router.push('/search-users')} style={styles.backBtn}>
          <Ionicons name="search" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : !canView ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed" size={22} color={colors.textFaint} />
          <Text style={styles.emptyText}>This list is private.</Text>
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { marginTop: 40 }]}>
              {type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/user-profile?id=${item.id}`)}
            >
              <Avatar avatarId={item.avatar_id} frameId={item.avatar_frame} avatarUrl={item.avatar_url} username={item.display_name} size={44} />
              <View style={styles.rowInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.username} numberOfLines={1}>{item.display_name ?? 'Unknown'}</Text>
                  {item.is_verified && <VerifiedBadge size={13} />}
                </View>
                {item.username && <Text style={styles.handle} numberOfLines={1}>@{item.username}</Text>}
              </View>
              {renderActionButton(item)}
            </TouchableOpacity>
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
    listContent: { padding: 24, paddingTop: 8 },
    emptyContainer: { alignItems: 'center', gap: 10, marginTop: 60 },
    emptyText: { color: colors.textFaint, textAlign: 'center' },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 14, padding: 12,
      marginBottom: 10, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    rowInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    username: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    handle: { color: colors.textTertiary, fontSize: 12, marginTop: 2, fontWeight: '600' },
    actionBtn: {
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
      backgroundColor: colors.accent, minWidth: 96, alignItems: 'center',
    },
    actionBtnActive: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.accent },
    actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    actionBtnTextActive: { color: colors.accent },
    actionBtnOutline: {
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
      minWidth: 96, alignItems: 'center',
    },
    actionBtnOutlineText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  });
}
