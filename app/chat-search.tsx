import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import VerifiedBadge from '@/components/VerifiedBadge';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function ChatSearchScreen() {
  const { mode } = useLocalSearchParams<{ mode: 'personal' | 'group' }>();
  const isGroup = mode === 'group';
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [myChats, setMyChats] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => { init(); }, [mode]);

  async function init() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id ?? null;
    setMyId(me);
    if (!me) { setLoading(false); return; }

    const { data: myParticipation } = await supabase
      .from('conversation_participants')
      .select('conversation_id, status')
      .eq('user_id', me);

    const relevantIds = (myParticipation ?? [])
      .filter((r: any) => isGroup || r.status === 'accepted')
      .map((r: any) => r.conversation_id);

    const chatRows: any[] = [];
    const knownOtherIds = new Set<string>();

    if (relevantIds.length > 0) {
      const { data: convos } = await supabase
        .from('conversations')
        .select('*')
        .in('id', relevantIds)
        .eq('conversation_type', isGroup ? 'group' : 'direct');

      if (isGroup) {
        for (const c of convos ?? []) {
          chatRows.push({ id: c.id, title: c.name ?? 'Group Chat', avatarUrl: c.avatar_url, isGroup: true });
        }
      } else {
        const directIds = (convos ?? []).map((c: any) => c.id);
        const { data: participants } = directIds.length > 0
          ? await supabase.from('conversation_participants').select('conversation_id, user_id').in('conversation_id', directIds)
          : { data: [] };

        const otherIdByConvo = new Map<string, string>();
        for (const p of participants ?? []) {
          if (p.user_id !== me) otherIdByConvo.set(p.conversation_id, p.user_id);
        }
        const otherIds = [...new Set(otherIdByConvo.values())];
        const { data: profiles } = otherIds.length > 0
          ? await supabase.from('public_profiles').select('id, username, display_name, avatar_id, avatar_url, is_verified').in('id', otherIds)
          : { data: [] };
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

        for (const c of convos ?? []) {
          const otherId = otherIdByConvo.get(c.id);
          const profile = otherId ? profileMap.get(otherId) : null;
          if (otherId) knownOtherIds.add(otherId);
          chatRows.push({
            id: c.id, title: profile?.display_name ?? 'Unknown User',
            avatarId: profile?.avatar_id, avatarUrl: profile?.avatar_url,
            isVerified: profile?.is_verified, isGroup: false,
          });
        }
      }
    }

    setMyChats(chatRows);

    if (!isGroup) {
      let sb = supabase
        .from('public_profiles')
        .select('id, username, display_name, avatar_id, avatar_url, is_verified')
        .neq('id', me)
        .order('username', { ascending: true })
        .limit(40);
      const { data: candidates } = await sb;
      setSuggested((candidates ?? []).filter((p: any) => !knownOtherIds.has(p.id)));
    }

    setLoading(false);
  }

  async function startChat(userId: string) {
    setStartingId(userId);
    const { data, error } = await supabase.rpc('start_direct_conversation', { other_user_id: userId });
    setStartingId(null);
    if (error) return;
    router.replace(`/chat-thread?id=${data}`);
  }

  const q = query.trim().toLowerCase();
  const filteredChats = q ? myChats.filter((c) => c.title?.toLowerCase().includes(q)) : myChats;
  const filteredSuggested = q
    ? suggested.filter((p) => p.display_name?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q))
    : suggested;

  function renderChatRow(item: any) {
    return (
      <TouchableOpacity style={styles.row} onPress={() => router.replace(`/chat-thread?id=${item.id}`)}>
        {item.isGroup ? (
          item.avatarUrl ? (
            <Avatar avatarUrl={item.avatarUrl} username={item.title} size={46} />
          ) : (
            <LinearGradient colors={['#7C3AED', '#4C1D95']} style={styles.groupIcon}>
              <Ionicons name="people" size={20} color="#fff" />
            </LinearGradient>
          )
        ) : (
          <Avatar avatarId={item.avatarId} avatarUrl={item.avatarUrl} username={item.title} size={46} />
        )}
        <View style={styles.rowInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName} numberOfLines={1}>{item.title}</Text>
            {item.isVerified && <VerifiedBadge size={13} />}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
      </TouchableOpacity>
    );
  }

  function renderSuggestedRow(item: any) {
    return (
      <TouchableOpacity style={styles.row} onPress={() => startChat(item.id)} disabled={startingId === item.id}>
        <Avatar avatarId={item.avatar_id} avatarUrl={item.avatar_url} username={item.display_name} size={46} />
        <View style={styles.rowInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName} numberOfLines={1}>{item.display_name ?? 'Unknown'}</Text>
            {item.is_verified && <VerifiedBadge size={13} />}
          </View>
          {item.username && <Text style={styles.handle}>@{item.username}</Text>}
        </View>
        {startingId === item.id
          ? <ActivityIndicator size="small" color={colors.accent} />
          : <Ionicons name="chatbubble-outline" size={18} color={colors.accent} />
        }
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isGroup ? 'Search Groups' : 'Search Chats'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={isGroup ? 'Search your groups...' : 'Search chats or find people...'}
          placeholderTextColor={colors.textDisabled}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : isGroup ? (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {q ? `No groups matching "${query.trim()}"` : "You're not in any groups yet."}
              </Text>
            </View>
          }
          renderItem={({ item }) => renderChatRow(item)}
        />
      ) : (
        <FlatList
          data={filteredSuggested}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              {filteredChats.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>YOUR CHATS</Text>
                  {filteredChats.map((item) => (
                    <View key={item.id}>{renderChatRow(item)}</View>
                  ))}
                </>
              )}
              {filteredSuggested.length > 0 && (
                <Text style={styles.sectionLabel}>{q ? 'OTHER PEOPLE' : 'START A NEW CHAT'}</Text>
              )}
            </>
          }
          ListEmptyComponent={
            filteredChats.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {q ? `No matches for "${query.trim()}"` : 'No suggestions right now'}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => renderSuggestedRow(item)}
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
    searchRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 14,
      borderWidth: 1, borderColor: colors.border,
      marginHorizontal: 24, marginBottom: 16,
    },
    searchInput: { flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 12 },
    listContent: { padding: 24, paddingTop: 0 },
    sectionLabel: {
      color: colors.textMuted, fontSize: 11, fontWeight: '800',
      letterSpacing: 1.5, marginBottom: 12, marginTop: 4,
    },
    emptyContainer: { alignItems: 'center', gap: 10, marginTop: 60, paddingHorizontal: 20 },
    emptyText: { color: colors.textFaint, textAlign: 'center' },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 14, padding: 12,
      marginBottom: 10, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    groupIcon: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
    rowInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    displayName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    handle: { color: colors.textTertiary, fontSize: 12, marginTop: 2, fontWeight: '600' },
  });
}
