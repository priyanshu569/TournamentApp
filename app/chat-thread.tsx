import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Alert, Keyboard
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, SharedValue } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import { formatClockTime, formatDayLabel, formatRelativeTime, isSameDay } from '@/lib/time';

function MessageBubble({ message, isMine, showSenderName, senderName, swipeX, seenLabel }: {
  message: any;
  isMine: boolean;
  showSenderName: boolean;
  senderName: string;
  swipeX: SharedValue<number>;
  seenLabel: string | null;
}) {
  const bubbleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));
  const timeAnimStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(swipeX.value) / 36),
  }));

  return (
    <View>
      <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
        <Animated.View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs, bubbleAnimStyle]}>
          {showSenderName && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          <Text style={styles.messageText}>{message.content}</Text>
        </Animated.View>
        <Animated.View style={[styles.swipeTimeWrap, timeAnimStyle]} pointerEvents="none">
          <Text style={styles.swipeTimeText}>{formatClockTime(message.created_at)}</Text>
        </Animated.View>
      </View>
      {seenLabel && (
        <Text style={styles.seenText}>{seenLabel}</Text>
      )}
    </View>
  );
}

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [myId, setMyId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [participantNames, setParticipantNames] = useState<Map<string, string>>(new Map());
  const [participantList, setParticipantList] = useState<{ id: string; username: string }[]>([]);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const listRef = useRef<FlatList>(null);
  const swipeX = useSharedValue(0);

  useEffect(() => { loadThread(); }, [id]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`messages_${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          if (payload.new.sender_id !== myId) {
            supabase.rpc('mark_messages_read', { p_conversation_id: id });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, myId]);

  const rows = useMemo(() => {
    const result: any[] = [];
    let lastDate: string | null = null;
    for (const m of messages) {
      if (!lastDate || !isSameDay(m.created_at, lastDate)) {
        result.push({ type: 'separator', id: `sep-${m.id}`, label: formatDayLabel(m.created_at) });
        lastDate = m.created_at;
      }
      result.push({ type: 'message', ...m });
    }
    return result;
  }, [messages]);

  const lastMessage = messages[messages.length - 1];
  const showSeenOnLast = conversation?.conversation_type === 'direct'
    && !!lastMessage && lastMessage.sender_id === myId;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 999])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      swipeX.value = Math.max(-60, Math.min(0, e.translationX));
    })
    .onEnd(() => {
      swipeX.value = withSpring(0, { damping: 20, stiffness: 200 });
    });

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
      ? await supabase.from('public_profiles').select('id, display_name, avatar_id, avatar_url').in('id', participantIds)
      : { data: [] };

    const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name ?? 'Unknown']));
    setParticipantNames(nameMap);
    setParticipantList(
      (profiles ?? [])
        .filter((p: any) => p.id !== me)
        .map((p: any) => ({ id: p.id, username: p.display_name ?? 'Unknown' }))
    );

    if (convo?.conversation_type === 'direct') {
      const other = (profiles ?? []).find((p: any) => p.id !== me);
      setOtherUser(other ?? null);
    }

    const { data: msgs, error: msgsError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (msgsError) {
      console.log('Failed to load messages:', msgsError.message);
      Alert.alert('Error loading messages', msgsError.message);
    }

    setMessages(msgs ?? []);
    setLoading(false);

    if (me) {
      await supabase.rpc('mark_messages_read', { p_conversation_id: id });
    }
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
    } else {
      console.log('Failed to send message:', error.message);
      Alert.alert('Message not sent', error.message);
    }
    setSending(false);
  }

  function confirmLeaveGroup() {
    setOptionsVisible(false);
    Alert.alert(
      'Leave Group?',
      "You'll no longer see messages in this group.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave Group', style: 'destructive', onPress: handleLeaveGroup },
      ]
    );
  }

  async function handleLeaveGroup() {
    if (!myId) return;
    setLeaving(true);

    const { error } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', id)
      .eq('user_id', myId);

    setLeaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    router.back();
  }

  const title = conversation?.conversation_type === 'direct'
    ? (otherUser?.display_name ?? 'Chat')
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
      keyboardVerticalOffset={0}
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
              <Avatar avatarId={otherUser?.avatar_id} avatarUrl={otherUser?.avatar_url} username={otherUser?.display_name} size={32} />
            ) : (
              <LinearGradient colors={['#7C3AED', '#4C1D95']} style={styles.groupIconSmall}>
                <Ionicons name="people" size={16} color="#fff" />
              </LinearGradient>
            )}
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          </TouchableOpacity>
          {conversation?.conversation_type === 'group' ? (
            <TouchableOpacity onPress={() => setOptionsVisible(true)} style={styles.reportBtn}>
              <Ionicons name="ellipsis-vertical" size={20} color="#aaa" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        <GestureDetector gesture={panGesture}>
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              if (item.type === 'separator') {
                return (
                  <View style={styles.dateSeparatorRow}>
                    <Text style={styles.dateSeparatorText}>{item.label}</Text>
                  </View>
                );
              }

              const isMine = item.sender_id === myId;
              return (
                <MessageBubble
                  message={item}
                  isMine={isMine}
                  showSenderName={!isMine && conversation?.conversation_type === 'group'}
                  senderName={participantNames.get(item.sender_id) ?? 'Unknown'}
                  swipeX={swipeX}
                  seenLabel={
                    showSeenOnLast && item.id === lastMessage?.id
                      ? (item.read_at ? `Seen ${formatRelativeTime(item.read_at)}` : 'Delivered')
                      : null
                  }
                />
              );
            }}
          />
        </GestureDetector>

        <View style={[styles.inputRow, { paddingBottom: keyboardVisible ? 12 : 34 }]}>
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

      <Modal
        visible={optionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOptionsVisible(false)}
        >
          <View style={styles.reportSheet}>
            <Text style={styles.reportSheetTitle}>Group Options</Text>

            <TouchableOpacity style={styles.leaveGroupRow} onPress={confirmLeaveGroup} disabled={leaving}>
              <Ionicons name="exit-outline" size={18} color="#ff4444" />
              {leaving
                ? <ActivityIndicator size="small" color="#ff4444" />
                : <Text style={styles.leaveGroupText}>Leave Group</Text>
              }
            </TouchableOpacity>

            <Text style={styles.reportSheetSubtitle}>Report a member</Text>
            {participantList.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.reportSheetRow}
                onPress={() => {
                  setOptionsVisible(false);
                  router.push(`/report-user?target_user_id=${p.id}`);
                }}
              >
                <Text style={styles.reportSheetRowText}>{p.username}</Text>
                <Ionicons name="chevron-forward" size={18} color="#555" />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
  },
  groupIconSmall: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  reportBtn: { padding: 4, width: 26, alignItems: 'flex-end' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800', flexShrink: 1 },
  messagesList: { padding: 16, paddingBottom: 24 },
  dateSeparatorRow: { alignItems: 'center', marginVertical: 12 },
  dateSeparatorText: {
    color: '#888', fontSize: 11, fontWeight: '700',
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
    overflow: 'hidden',
  },
  messageRow: { flexDirection: 'row', marginBottom: 10 },
  messageRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleTheirs: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  bubbleMine: { backgroundColor: '#7C3AED' },
  senderName: { color: '#7C3AED', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  messageText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  swipeTimeWrap: {
    position: 'absolute', right: 4, top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'flex-end',
  },
  swipeTimeText: { color: '#888', fontSize: 11, fontWeight: '600' },
  seenText: {
    color: '#666', fontSize: 11, fontWeight: '600',
    textAlign: 'right', marginTop: -6, marginBottom: 8, marginRight: 4,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
  },
  input: {
    flex: 1, backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: '#2a2a2a', maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  reportSheet: {
    backgroundColor: '#141414', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34,
    maxHeight: '60%', borderWidth: 1, borderColor: '#2a2a2a', borderBottomWidth: 0,
  },
  reportSheetTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  leaveGroupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  leaveGroupText: { color: '#ff4444', fontSize: 15, fontWeight: '700' },
  reportSheetSubtitle: { color: '#666', fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 4 },
  reportSheetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#2a2a2a',
  },
  reportSheetRowText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
