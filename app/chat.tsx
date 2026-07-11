import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';

export default function ChatInboxScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

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
      ? await supabase.from('public_profiles').select('id, username, avatar_id').in('id', otherUserIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    const { data: recentMessages } = await supabase
      .from('messages')
      .select('conversation_id, content, created_at, sender_id')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    const lastMessageMap = new Map<string, any>();
    for (const m of recentMessages ?? []) {
      if (!lastMessageMap.has(m.conversation_id)) {
        lastMessageMap.set(m.conversation_id, m);
      }
    }

    const built = (convos ?? []).map((c: any) => {
      const lastMessage = lastMessageMap.get(c.id);
      let title = c.name ?? 'Group Chat';
      let avatarId: string | null = null;
      let avatarUsername: string | null = null;

      if (c.conversation_type === 'direct') {
        const otherId = (allParticipants ?? []).find(
          (p: any) => p.conversation_id === c.id && p.user_id !== me
        )?.user_id;
        const otherProfile = otherId ? profileMap.get(otherId) : null;
        title = otherProfile?.username ?? 'Unknown User';
        avatarId = otherProfile?.avatar_id ?? null;
        avatarUsername = otherProfile?.username ?? null;
      }

      return {
        id: c.id,
        type: c.conversation_type,
        title,
        avatarId,
        avatarUsername,
        lastMessage: lastMessage?.content ?? null,
        lastMessageAt: lastMessage?.created_at ?? c.created_at,
      };
    });

    built.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    setConversations(built);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity onPress={() => router.push('/new-group')} style={styles.newGroupBtn}>
          <Ionicons name="people" size={22} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No conversations yet. Message someone from their profile, or start a group.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/chat-thread?id=${item.id}`)}
            >
              {item.type === 'direct' ? (
                <Avatar avatarId={item.avatarId} username={item.avatarUsername} size={48} />
              ) : (
                <View style={styles.groupIcon}>
                  <Ionicons name="people" size={22} color="#fff" />
                </View>
              )}
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowPreview} numberOfLines={1}>
                  {item.lastMessage ?? 'No messages yet'}
                </Text>
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
    alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  newGroupBtn: { padding: 8 },
  listContent: { padding: 24, paddingTop: 4 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#2a2a2a',
  },
  groupIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center',
  },
  rowInfo: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  rowPreview: { color: '#888', fontSize: 13 },
});
