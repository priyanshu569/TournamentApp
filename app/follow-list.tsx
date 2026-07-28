import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, FlatList
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

  useEffect(() => { loadList(); }, [id, type]);

  async function loadList() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id ?? null;

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
      .select('id, display_name, avatar_id, avatar_url, is_verified')
      .in('id', otherIds);

    setPeople(profiles ?? []);
    setLoading(false);
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
              <Avatar avatarId={item.avatar_id} avatarUrl={item.avatar_url} username={item.display_name} size={44} />
              <View style={styles.rowInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.username}>{item.display_name ?? 'Unknown'}</Text>
                  {item.is_verified && <VerifiedBadge size={13} />}
                </View>
              </View>
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
  });
}
