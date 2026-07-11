import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, FlatList
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import VerifiedBadge from '@/components/VerifiedBadge';

export default function FollowListScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: 'followers' | 'following' }>();
  const router = useRouter();
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
      .select('id, username, avatar_id, is_verified')
      .in('id', otherIds);

    setPeople(profiles ?? []);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{type === 'followers' ? 'Followers' : 'Following'}</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
      ) : !canView ? (
        <Text style={styles.emptyText}>🔒 This list is private.</Text>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/user-profile?id=${item.id}`)}
            >
              <Avatar avatarId={item.avatar_id} username={item.username} size={44} />
              <View style={styles.rowInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.username}>{item.username ?? 'Unknown'}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  listContent: { padding: 24, paddingTop: 8 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: '#2a2a2a',
  },
  rowInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
