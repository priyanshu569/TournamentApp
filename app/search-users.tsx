import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import VerifiedBadge from '@/components/VerifiedBadge';

export default function SearchUsersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [actingId, setActingId] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id ?? null;
    setMyId(me);

    const following = new Set<string>();
    if (me) {
      const { data: rows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', me);
      (rows ?? []).forEach((r: any) => following.add(r.following_id));
    }
    setFollowingIds(following);

    let sb = supabase
      .from('public_profiles')
      .select('id, username, display_name, avatar_id, avatar_url, is_verified')
      .order('username', { ascending: true })
      .limit(30);
    if (me) sb = sb.neq('id', me);

    const { data: suggestions } = await sb;
    setSuggested((suggestions ?? []).filter((p: any) => !following.has(p.id)));
    setSuggestedLoading(false);
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => search(trimmed), 350);
    return () => clearTimeout(timer);
  }, [query]);

  async function search(q: string) {
    // PostgREST's .or() filter syntax uses "," and "()" as separators/grouping,
    // so strip them from free-typed search text before building the filter.
    const safeQ = q.replace(/[,()]/g, '');
    if (!safeQ) { setResults([]); return; }

    let sb = supabase
      .from('public_profiles')
      .select('id, username, display_name, avatar_id, avatar_url, is_verified')
      .or(`username.ilike.%${safeQ}%,display_name.ilike.%${safeQ}%`)
      .limit(30);

    if (myId) sb = sb.neq('id', myId);

    const { data } = await sb;
    setResults(data ?? []);
    setLoading(false);
  }

  async function toggleFollow(targetId: string) {
    if (!myId) return;
    setActingId(targetId);

    if (followingIds.has(targetId)) {
      await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', targetId);
      setFollowingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: myId, following_id: targetId });
      if (!error) {
        setFollowingIds((prev) => new Set(prev).add(targetId));
      }
    }

    setActingId(null);
  }

  function renderUserRow(item: any) {
    const isFollowing = followingIds.has(item.id);
    return (
      <TouchableOpacity style={styles.row} onPress={() => router.push(`/user-profile?id=${item.id}`)}>
        <Avatar avatarId={item.avatar_id} avatarUrl={item.avatar_url} username={item.display_name} size={46} />
        <View style={styles.rowInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName} numberOfLines={1}>{item.display_name ?? 'Unknown'}</Text>
            {item.is_verified && <VerifiedBadge size={13} />}
          </View>
          {item.username && <Text style={styles.handle}>@{item.username}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followBtnActive]}
          onPress={(e) => { e.stopPropagation(); toggleFollow(item.id); }}
          disabled={actingId === item.id}
        >
          {actingId === item.id
            ? <ActivityIndicator size="small" color={isFollowing ? '#7C3AED' : '#fff'} />
            : (
              <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )
          }
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  const isSearching = query.trim().length > 0;
  const listData = isSearching ? results : suggested;
  const listLoading = isSearching ? loading : suggestedLoading;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find People</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username or name..."
          placeholderTextColor="#444"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      {listLoading ? (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            !isSearching && listData.length > 0 ? (
              <Text style={styles.sectionLabel}>SUGGESTED FOR YOU</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name={isSearching ? 'person-outline' : 'people-outline'} size={28} color="#444" />
              </View>
              <Text style={styles.emptyText}>
                {isSearching ? `No users found for "${query.trim()}"` : 'No suggestions right now'}
              </Text>
            </View>
          }
          renderItem={({ item }) => renderUserRow(item)}
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
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1a1a1a', borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#2a2a2a',
    marginHorizontal: 24, marginBottom: 16,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
  listContent: { padding: 24, paddingTop: 0 },
  sectionLabel: {
    color: '#666', fontSize: 11, fontWeight: '800',
    letterSpacing: 1.5, marginBottom: 12,
  },
  emptyContainer: { alignItems: 'center', gap: 10, marginTop: 60, paddingHorizontal: 20 },
  emptyIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  emptyText: { color: '#555', textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#161616', borderRadius: 14, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: '#262626',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  rowInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  displayName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  handle: { color: '#888', fontSize: 12, marginTop: 2, fontWeight: '600' },
  followBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#7C3AED', minWidth: 92, alignItems: 'center',
  },
  followBtnActive: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#7C3AED' },
  followBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  followBtnTextActive: { color: '#7C3AED' },
});
