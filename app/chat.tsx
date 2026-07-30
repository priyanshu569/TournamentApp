import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import GradientIconBadge from '@/components/GradientIconBadge';
import { formatRelativeTime } from '@/lib/time';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { useTabNavigation } from '@/lib/tabNavigation';

export default function ChatInboxScreen() {
  const router = useRouter();
  const tabNav = useTabNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [category, setCategory] = useState<'personal' | 'group'>('personal');

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  // The pager keeps every tab mounted, so useFocusEffect above only
  // fires on entering/leaving "(tabs)" as a whole, not on internal
  // pager swipes. Re-fetch whenever this tab actually becomes visible.
  useEffect(() => {
    if (tabNav?.activeTab === 'chat') {
      loadConversations();
    }
  }, [tabNav?.activeTab]);

  async function loadConversations() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id;
    if (!me) { setLoading(false); return; }
    setMyId(me);

    const { data: myParticipation } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', me);

    const conversationIds = (myParticipation ?? []).map((r: any) => r.conversation_id);

    if (conversationIds.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const { data: convos } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds);

    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds);

    const otherUserIds = [...new Set(
      (allParticipants ?? [])
        .filter((p: any) => p.user_id !== me)
        .map((p: any) => p.user_id)
    )];

    const { data: profiles } = otherUserIds.length > 0
      ? await supabase.from('public_profiles').select('id, display_name, avatar_id, avatar_url').in('id', otherUserIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const { data: recentMessages } = await supabase
      .from('messages')
      .select('conversation_id, content, created_at, sender_id, read_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    const lastMessageMap = new Map<string, any>();
    const unreadCountMap = new Map<string, number>();
    for (const m of recentMessages ?? []) {
      if (!lastMessageMap.has(m.conversation_id)) {
        lastMessageMap.set(m.conversation_id, m);
      }
      if (m.sender_id !== me && !m.read_at) {
        unreadCountMap.set(m.conversation_id, (unreadCountMap.get(m.conversation_id) ?? 0) + 1);
      }
    }

    const built = (convos ?? []).map((c: any) => {
      const lastMessage = lastMessageMap.get(c.id);
      let title = c.name ?? 'Group Chat';
      let avatarId: string | null = null;
      let avatarUrl: string | null = null;
      let avatarUsername: string | null = null;

      if (c.conversation_type === 'direct') {
        const otherId = (allParticipants ?? []).find(
          (p: any) => p.conversation_id === c.id && p.user_id !== me
        )?.user_id;
        const otherProfile = otherId ? profileMap.get(otherId) : null;
        title = otherProfile?.display_name ?? 'Unknown User';
        avatarId = otherProfile?.avatar_id ?? null;
        avatarUrl = otherProfile?.avatar_url ?? null;
        avatarUsername = otherProfile?.display_name ?? null;
      } else {
        avatarUrl = c.avatar_url ?? null;
        avatarUsername = title;
      }

      return {
        id: c.id,
        type: c.conversation_type,
        title,
        avatarId,
        avatarUrl,
        avatarUsername,
        lastMessage: lastMessage?.content ?? null,
        lastMessageAt: lastMessage?.created_at ?? c.created_at,
        unreadCount: unreadCountMap.get(c.id) ?? 0,
      };
    });

    built.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    setConversations(built);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <GradientIconBadge icon="chatbubbles" size={44} colors={['#7C3AED', '#4C1D95']} />
          <Text style={styles.headerTitle}>Chats</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => router.push('/search-users')} style={styles.headerBtn}>
            <Ionicons name="search" size={18} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/new-group')} style={styles.headerBtn}>
            <Ionicons name="people" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.categoryRow}>
        <TouchableOpacity
          style={[styles.categoryTab, category === 'personal' && styles.categoryTabActive]}
          onPress={() => setCategory('personal')}
        >
          <Ionicons name="person" size={14} color={category === 'personal' ? '#fff' : colors.textTertiary} />
          <Text style={[styles.categoryTabText, category === 'personal' && styles.categoryTabTextActive]}>Personal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.categoryTab, category === 'group' && styles.categoryTabActive]}
          onPress={() => setCategory('group')}
        >
          <Ionicons name="people" size={14} color={category === 'group' ? '#fff' : colors.textTertiary} />
          <Text style={[styles.categoryTabText, category === 'group' && styles.categoryTabTextActive]}>Group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.categoryTab} onPress={() => router.push('/world-chat')}>
          <Ionicons name="globe" size={14} color="#2E9BFF" />
          <Text style={[styles.categoryTabText, { color: '#2E9BFF' }]}>World</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={conversations.filter((c) => c.type === (category === 'personal' ? 'direct' : 'group'))}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <GradientIconBadge
                icon="chatbubble-ellipses-outline"
                size={72}
                colors={[colors.surfaceAlt, colors.surfaceAlt]}
                iconColor={colors.textDisabled}
                glowColor="transparent"
              />
              <Text style={styles.emptyText}>
                {category === 'personal'
                  ? 'No personal chats yet. Message someone from their profile.'
                  : "No group chats yet. Tap the people icon above to start one."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUnread = item.unreadCount > 0;
            return (
              <TouchableOpacity
                style={[styles.row, isUnread && styles.rowUnread]}
                activeOpacity={0.85}
                onPress={() => router.push(`/chat-thread?id=${item.id}`)}
              >
                <View style={[styles.avatarRing, isUnread && styles.avatarRingUnread]}>
                  {item.type === 'direct' ? (
                    <Avatar avatarId={item.avatarId} avatarUrl={item.avatarUrl} username={item.avatarUsername} size={50} />
                  ) : item.avatarUrl ? (
                    <Avatar avatarUrl={item.avatarUrl} username={item.avatarUsername} size={50} />
                  ) : (
                    <LinearGradient colors={['#7C3AED', '#4C1D95']} style={styles.groupIcon}>
                      <Ionicons name="people" size={22} color="#fff" />
                    </LinearGradient>
                  )}
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  <Text
                    style={[styles.rowPreview, isUnread && styles.rowPreviewUnread]}
                    numberOfLines={1}
                  >
                    {item.lastMessage ?? 'No messages yet'}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowTime, isUnread && styles.rowTimeUnread]}>
                    {formatRelativeTime(item.lastMessageAt)}
                  </Text>
                  {isUnread && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {item.unreadCount > 9 ? '9+' : item.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
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
      alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.2 },
    headerBtn: {
      width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accentMuted,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1, borderColor: colors.accentMutedStrong,
    },
    categoryRow: {
      flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingBottom: 16,
    },
    categoryTab: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    categoryTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    categoryTabText: { color: colors.textTertiary, fontSize: 13, fontWeight: '700' },
    categoryTabTextActive: { color: '#fff' },
    listContent: { padding: 24, paddingTop: 4 },
    emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20, gap: 16 },
    emptyText: { color: colors.textFaint, textAlign: 'center', lineHeight: 20 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: colors.surface, borderRadius: 20, padding: 14,
      marginBottom: 12, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
    },
    rowUnread: {
      backgroundColor: colors.accentMuted,
      borderColor: colors.accentMutedStrong,
      shadowColor: colors.accent,
      shadowOpacity: 0.2,
    },
    avatarRing: {
      padding: 2, borderRadius: 29, borderWidth: 1.5, borderColor: 'transparent',
    },
    avatarRingUnread: { borderColor: colors.accent },
    groupIcon: {
      width: 50, height: 50, borderRadius: 25,
      justifyContent: 'center', alignItems: 'center',
    },
    rowInfo: { flex: 1 },
    rowTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 3 },
    rowPreview: { color: colors.textTertiary, fontSize: 13 },
    rowPreviewUnread: { color: colors.textPrimary, fontWeight: '700' },
    rowRight: { alignItems: 'flex-end', gap: 6 },
    rowTime: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
    rowTimeUnread: { color: colors.accent },
    unreadBadge: {
      minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
      backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
    },
    unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  });
}
