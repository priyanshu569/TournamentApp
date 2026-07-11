import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [myId, setMyId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [participantNames, setParticipantNames] = useState<Map<string, string>>(new Map());
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => { loadThread(); }, [id]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages_${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function loadThread() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id ?? null;
    setMyId(me);

    const { data: convo } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();
    setConversation(convo);

    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', id);

    const participantIds = (participants ?? []).map((p: any) => p.user_id);

    const { data: profiles } = participantIds.length > 0
      ? await supabase.from('public_profiles').select('id, username, avatar_id').in('id', participantIds)
      : { data: [] };

    const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.username ?? 'Unknown']));
    setParticipantNames(nameMap);

    if (convo?.conversation_type === 'direct') {
      const other = (profiles ?? []).find((p: any) => p.id !== me);
      setOtherUser(other ?? null);
    }

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    setMessages(msgs ?? []);
    setLoading(false);
  }

  async function handleSend() {
    if (!text.trim() || !myId) return;
    setSending(true);

    const { error } = await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: myId,
      content: text.trim(),
    });

    if (!error) {
      setText('');
    }
    setSending(false);
  }

  const title = conversation?.conversation_type === 'direct'
    ? (otherUser?.username ?? 'Chat')
    : (conversation?.name ?? 'Group Chat');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerTitleRow}
            onPress={() => otherUser?.id && router.push(`/user-profile?id=${otherUser.id}`)}
            disabled={!otherUser}
          >
            {conversation?.conversation_type === 'direct' ? (
              <Avatar avatarId={otherUser?.avatar_id} username={otherUser?.username} size={32} />
            ) : (
              <Ionicons name="people" size={24} color="#7C3AED" />
            )}
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          </TouchableOpacity>
          <View style={{ width: 26 }} />
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMine = item.sender_id === myId;
            return (
              <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!isMine && conversation?.conversation_type === 'group' && (
                    <Text style={styles.senderName}>
                      {participantNames.get(item.sender_id) ?? 'Unknown'}
                    </Text>
                  )}
                  <Text style={styles.messageText}>{item.content}</Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#555"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending || !text.trim()}>
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  backBtn: { padding: 4 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800', flexShrink: 1 },
  messagesList: { padding: 16, paddingBottom: 24 },
  messageRow: { flexDirection: 'row', marginBottom: 10 },
  messageRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleTheirs: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  bubbleMine: { backgroundColor: '#7C3AED' },
  senderName: { color: '#7C3AED', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  messageText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, borderTopWidth: 1, borderTopColor: '#1a1a1a',
  },
  input: {
    flex: 1, backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: '#2a2a2a', maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center',
  },
});
