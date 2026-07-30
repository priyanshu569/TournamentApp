import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Image,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Alert, Keyboard
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, SharedValue } from 'react-native-reanimated';
import {
  useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets, setAudioModeAsync,
  useAudioPlayer, useAudioPlayerStatus, AudioQuality, IOSOutputFormat,
} from 'expo-audio';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import { formatClockTime, formatDayLabel, formatRelativeTime, isSameDay } from '@/lib/time';
import { uploadVoiceMessage, getSignedVoiceMessageUrl, formatAudioDuration } from '@/lib/voiceMessage';
import { pickChatImage, uploadChatImage, getSignedChatImageUrl } from '@/lib/chatImage';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

// Voice messages are speech, not music -- mono/low-bitrate keeps file
// size close to WhatsApp-sized (HIGH_QUALITY's stereo 128kbps default
// is ~4x larger than needed and meant for general audio recording).
const VOICE_MESSAGE_PRESET = {
  extension: '.m4a',
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 32000,
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    outputFormat: 'mpeg4' as const,
    audioEncoder: 'aac' as const,
  },
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.LOW,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 32000,
  },
};

// The RLS insert policy on messages rejects sends between blocked users
// with a raw "row-level security" error -- covers both directions (I
// blocked them, or they blocked me), since only my own block is known
// client-side.
function friendlySendError(message: string): string {
  return message.includes('row-level security')
    ? "You can't send messages in this conversation."
    : message;
}

function VoiceMessagePlayer({ message, isMine, styles, colors }: {
  message: any;
  isMine: boolean;
  styles: ReturnType<typeof getStyles>;
  colors: ThemeColors;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSignedUrl(null);
    setLoadError(null);
    async function load() {
      if (!message.audio_url) return;
      try {
        const url = await getSignedVoiceMessageUrl(message.audio_url);
        if (!cancelled) setSignedUrl(url);
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message ?? 'Failed to load audio');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [message.audio_url]);

  const iconColor = isMine ? '#fff' : colors.textPrimary;
  const durationLabel = formatAudioDuration(message.audio_duration_seconds ?? 0);

  if (loadError) {
    return (
      <TouchableOpacity
        style={styles.audioRow}
        onPress={() => Alert.alert('Voice message error', loadError)}
      >
        <View style={[styles.audioPlayBtn, isMine && styles.audioPlayBtnMine]}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
        </View>
        <Text style={[styles.audioDuration, isMine ? styles.messageTextMine : styles.messageTextTheirs]} numberOfLines={1}>
          Couldn't load audio
        </Text>
      </TouchableOpacity>
    );
  }

  if (!signedUrl) {
    return (
      <View style={styles.audioRow}>
        <View style={[styles.audioPlayBtn, isMine && styles.audioPlayBtnMine]}>
          <ActivityIndicator size="small" color={iconColor} />
        </View>
        <View style={styles.audioProgressTrack} />
        <Text style={[styles.audioDuration, isMine ? styles.messageTextMine : styles.messageTextTheirs]}>
          {durationLabel}
        </Text>
      </View>
    );
  }

  return (
    <VoiceMessagePlayerReady
      url={signedUrl}
      durationLabel={durationLabel}
      isMine={isMine}
      styles={styles}
      colors={colors}
    />
  );
}

function VoiceMessagePlayerReady({ url, durationLabel, isMine, styles, colors }: {
  url: string;
  durationLabel: string;
  isMine: boolean;
  styles: ReturnType<typeof getStyles>;
  colors: ThemeColors;
}) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const [playError, setPlayError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // useAudioPlayerStatus has no error field, so a corrupt/undecodable
  // source just never sets isLoaded -- it would otherwise spin forever.
  useEffect(() => {
    if (status.isLoaded) return;
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [status.isLoaded]);

  async function togglePlayback() {
    try {
      if (!status.isLoaded) return;
      // Audio session may still be routed for recording (earpiece-only
      // playback) if this device recorded a voice message earlier in
      // the session -- force it back to normal speaker playback first.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (status.playing) {
        player.pause();
      } else {
        if (status.currentTime >= status.duration && status.duration > 0) {
          player.seekTo(0);
        }
        player.play();
      }
    } catch (err: any) {
      setPlayError(err?.message ?? 'Failed to play audio');
    }
  }

  const failed = !!playError || (timedOut && !status.isLoaded);
  const progressPct = status.duration > 0 ? Math.min(100, (status.currentTime / status.duration) * 100) : 0;
  const iconColor = isMine ? '#fff' : colors.textPrimary;

  return (
    <TouchableOpacity
      style={styles.audioRow}
      onPress={failed
        ? () => Alert.alert('Voice message error', playError ?? 'This voice message could not be loaded. It may be corrupted.')
        : togglePlayback}
      disabled={!status.isLoaded && !failed}
    >
      <View style={[styles.audioPlayBtn, isMine && styles.audioPlayBtnMine]}>
        {failed
          ? <Ionicons name="alert-circle" size={16} color={colors.error} />
          : status.isLoaded
          ? <Ionicons name={status.playing ? 'pause' : 'play'} size={14} color={iconColor} />
          : <ActivityIndicator size="small" color={iconColor} />
        }
      </View>
      <View style={styles.audioProgressTrack}>
        <View style={[styles.audioProgressFill, { width: `${progressPct}%` }, isMine && styles.audioProgressFillMine]} />
      </View>
      <Text style={[styles.audioDuration, isMine ? styles.messageTextMine : styles.messageTextTheirs]}>
        {durationLabel}
      </Text>
    </TouchableOpacity>
  );
}

function ImageMessage({ message, isMine, styles, colors, onPress }: {
  message: any;
  isMine: boolean;
  styles: ReturnType<typeof getStyles>;
  colors: ThemeColors;
  onPress: (url: string) => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSignedUrl(null);
    setLoadError(false);
    async function load() {
      if (!message.image_url) return;
      try {
        const url = await getSignedChatImageUrl(message.image_url);
        if (!cancelled) setSignedUrl(url);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [message.image_url]);

  if (loadError) {
    return (
      <View style={[styles.imageBubble, styles.imageBubbleCenter]}>
        <Ionicons name="alert-circle" size={20} color={colors.error} />
        <Text style={styles.imageErrorText}>Couldn't load image</Text>
      </View>
    );
  }

  if (!signedUrl) {
    return (
      <View style={[styles.imageBubble, styles.imageBubbleCenter]}>
        <ActivityIndicator size="small" color={isMine ? '#fff' : colors.textPrimary} />
      </View>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(signedUrl)}>
      <Image source={{ uri: signedUrl }} style={styles.imageBubble} resizeMode="cover" />
    </TouchableOpacity>
  );
}

function MessageBubble({ message, isMine, showAvatar, showSenderName, senderName, senderAvatarId, senderAvatarUrl, swipeX, seenLabel, styles, colors, onImagePress }: {
  message: any;
  isMine: boolean;
  showAvatar: boolean;
  showSenderName: boolean;
  senderName: string;
  senderAvatarId: string | null;
  senderAvatarUrl: string | null;
  swipeX: SharedValue<number>;
  seenLabel: string | null;
  styles: ReturnType<typeof getStyles>;
  colors: ThemeColors;
  onImagePress: (url: string) => void;
}) {
  const bubbleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));
  const timeAnimStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(swipeX.value) / 36),
  }));

  return (
    <View>
      <View style={[styles.messageRow, isMine && styles.messageRowMine, showAvatar && styles.messageRowLast]}>
        {!isMine && (
          showAvatar
            ? <Avatar avatarId={senderAvatarId} avatarUrl={senderAvatarUrl} username={senderName} size={28} />
            : <View style={styles.avatarSpacer} />
        )}
        <Animated.View style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          message.image_url && styles.bubbleImage,
          bubbleAnimStyle,
        ]}>
          {showSenderName && (
            <Text style={[styles.senderName, message.image_url && styles.senderNameOnImage]}>{senderName}</Text>
          )}
          {message.image_url ? (
            <ImageMessage message={message} isMine={isMine} styles={styles} colors={colors} onPress={onImagePress} />
          ) : message.audio_url ? (
            <VoiceMessagePlayer message={message} isMine={isMine} styles={styles} colors={colors} />
          ) : (
            <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextTheirs]}>{message.content}</Text>
          )}
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [myId, setMyId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [participantProfiles, setParticipantProfiles] = useState<Map<string, any>>(new Map());
  const [participantList, setParticipantList] = useState<{ id: string; username: string }[]>([]);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const listRef = useRef<FlatList>(null);
  const swipeX = useSharedValue(0);
  const recordingStartRef = useRef<number>(0);
  const audioRecorder = useAudioRecorder(VOICE_MESSAGE_PRESET);
  const recorderState = useAudioRecorderState(audioRecorder, 200);

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
    // Avatar (and the slightly larger gap after it) only shows on the
    // last message of a consecutive run from the same sender, not on
    // every message in the group.
    for (let i = 0; i < result.length; i++) {
      if (result[i].type !== 'message') continue;
      const next = result[i + 1];
      const sameNextSender = next?.type === 'message' && next.sender_id === result[i].sender_id;
      result[i].showAvatar = !sameNextSender;
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
      ? await supabase.from('public_profiles').select('id, username, display_name, avatar_id, avatar_url').in('id', participantIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setParticipantProfiles(profileMap);
    setParticipantList(
      (profiles ?? [])
        .filter((p: any) => p.id !== me)
        .map((p: any) => ({ id: p.id, username: p.display_name ?? 'Unknown' }))
    );

    if (convo?.conversation_type === 'direct') {
      const other = (profiles ?? []).find((p: any) => p.id !== me);
      setOtherUser(other ?? null);

      if (me && other) {
        const { data: blockRow } = await supabase
          .from('blocks')
          .select('id')
          .eq('blocker_id', me)
          .eq('blocked_id', other.id)
          .maybeSingle();
        setIsBlocked(!!blockRow);
      }
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
      Alert.alert('Message not sent', friendlySendError(error.message));
    }
    setSending(false);
  }

  function showImageSourcePicker() {
    Alert.alert('Send a Photo', undefined, [
      { text: 'Take Photo', onPress: () => handlePickImage('camera') },
      { text: 'Choose from Gallery', onPress: () => handlePickImage('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handlePickImage(source: 'camera' | 'library') {
    if (!myId) return;
    try {
      const picked = await pickChatImage(source);
      if (!picked) return;

      setUploadingImage(true);
      const path = await uploadChatImage(id, myId, picked.base64);
      const { error } = await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: myId,
        content: '📷 Photo',
        image_url: path,
      });
      if (error) throw error;
    } catch (err: any) {
      Alert.alert('Photo not sent', friendlySendError(err?.message ?? 'Please try again.'));
    }
    setUploadingImage(false);
  }

  async function startRecording() {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone access needed', 'Enable microphone access to record voice messages.');
      return;
    }

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
    recordingStartRef.current = Date.now();
    setIsRecording(true);
  }

  async function cancelRecording() {
    setIsRecording(false);
    try {
      await audioRecorder.stop();
    } catch (err) {
      console.log('Failed to cancel recording:', err);
    }
    // Leaving allowsRecording on routes any later playback to the
    // earpiece instead of the speaker -- restore normal playback mode.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }

  async function stopAndSendRecording() {
    if (!myId) return;
    setIsRecording(false);

    let uri: string | null = null;
    try {
      await audioRecorder.stop();
      uri = audioRecorder.uri;
    } catch (err) {
      console.log('Failed to stop recording:', err);
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

    if (!uri) return;

    const durationSeconds = Math.round((Date.now() - recordingStartRef.current) / 1000);
    setUploadingAudio(true);

    try {
      const path = await uploadVoiceMessage(id, myId, uri);
      const { error } = await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: myId,
        content: '🎤 Voice message',
        audio_url: path,
        audio_duration_seconds: durationSeconds,
      });
      if (error) throw error;
    } catch (err: any) {
      console.log('Failed to send voice message:', err.message);
      Alert.alert('Voice message not sent', friendlySendError(err.message ?? 'Please try again.'));
    }

    setUploadingAudio(false);
  }

  function confirmLeaveGroup() {
    setOptionsVisible(false);
    Alert.alert(
      'Leave Group?',
      "You'll no longer see messages in this group.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave Group', style: 'destructive', onPress: handleLeaveConversation },
      ]
    );
  }

  function confirmDeleteChat() {
    setOptionsVisible(false);
    Alert.alert(
      'Delete Chat?',
      "This removes the conversation from your list. The other person can still message you again later.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleLeaveConversation },
      ]
    );
  }

  async function handleLeaveConversation() {
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

  function confirmToggleBlock() {
    setOptionsVisible(false);
    if (isBlocked) {
      Alert.alert('Unblock User?', "You'll be able to message each other again.", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: handleUnblock },
      ]);
    } else {
      Alert.alert(
        'Block User?',
        "Neither of you will be able to send new messages in this chat.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block', style: 'destructive', onPress: handleBlock },
        ]
      );
    }
  }

  async function handleBlock() {
    if (!myId || !otherUser) return;
    const { error } = await supabase.from('blocks').insert({ blocker_id: myId, blocked_id: otherUser.id });
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setIsBlocked(true);
  }

  async function handleUnblock() {
    if (!myId || !otherUser) return;
    const { error } = await supabase.from('blocks').delete().eq('blocker_id', myId).eq('blocked_id', otherUser.id);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setIsBlocked(false);
  }

  const title = conversation?.conversation_type === 'direct'
    ? (otherUser?.display_name ?? 'Chat')
    : (conversation?.name ?? 'Group Chat');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
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
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
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
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
              {conversation?.conversation_type === 'direct' && otherUser?.username && (
                <Text style={styles.headerSubtitle} numberOfLines={1}>@{otherUser.username}</Text>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setOptionsVisible(true)} style={styles.reportBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
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
              const sender = participantProfiles.get(item.sender_id);
              return (
                <MessageBubble
                  message={item}
                  isMine={isMine}
                  showAvatar={item.showAvatar}
                  showSenderName={!isMine && conversation?.conversation_type === 'group'}
                  senderName={sender?.display_name ?? 'Unknown'}
                  senderAvatarId={sender?.avatar_id ?? null}
                  senderAvatarUrl={sender?.avatar_url ?? null}
                  swipeX={swipeX}
                  seenLabel={
                    showSeenOnLast && item.id === lastMessage?.id
                      ? (item.read_at ? `Seen ${formatRelativeTime(item.read_at)}` : 'Delivered')
                      : null
                  }
                  styles={styles}
                  colors={colors}
                  onImagePress={setPreviewImageUrl}
                />
              );
            }}
          />
        </GestureDetector>

        {isBlocked ? (
          <View style={[styles.inputRow, styles.blockedBanner, { paddingBottom: keyboardVisible ? 12 : 34 }]}>
            <Ionicons name="ban" size={16} color={colors.error} />
            <Text style={styles.blockedBannerText}>You've blocked this user.</Text>
            <TouchableOpacity onPress={confirmToggleBlock}>
              <Text style={styles.blockedBannerAction}>Unblock</Text>
            </TouchableOpacity>
          </View>
        ) : isRecording ? (
          <View style={[styles.inputRow, { paddingBottom: keyboardVisible ? 12 : 34 }]}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                Recording... {formatAudioDuration(recorderState.durationMillis / 1000)}
              </Text>
            </View>
            <TouchableOpacity style={styles.recordingCancelBtn} onPress={cancelRecording}>
              <Ionicons name="close" size={20} color={colors.error} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendBtn} onPress={stopAndSendRecording} disabled={uploadingAudio}>
              {uploadingAudio
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="checkmark" size={20} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.inputRow, { paddingBottom: keyboardVisible ? 12 : 34 }]}>
            <TouchableOpacity style={styles.cameraBtn} onPress={showImageSourcePicker} disabled={uploadingImage}>
              {uploadingImage
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <Ionicons name="camera" size={20} color={colors.accent} />
              }
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor={colors.textFaint}
              value={text}
              onChangeText={setText}
              multiline
            />
            <TouchableOpacity style={styles.micBtn} onPress={startRecording}>
              <Ionicons name="mic" size={20} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending || !text.trim()}>
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={18} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal
        visible={!!previewImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <TouchableOpacity
          style={styles.imagePreviewOverlay}
          activeOpacity={1}
          onPress={() => setPreviewImageUrl(null)}
        >
          <TouchableOpacity style={styles.imagePreviewCloseBtn} onPress={() => setPreviewImageUrl(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {previewImageUrl && (
            <Image source={{ uri: previewImageUrl }} style={styles.imagePreviewFull} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>

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
            {conversation?.conversation_type === 'direct' ? (
              <>
                <Text style={styles.reportSheetTitle}>Chat Options</Text>

                <TouchableOpacity style={styles.leaveGroupRow} onPress={confirmToggleBlock}>
                  <Ionicons name={isBlocked ? 'lock-open-outline' : 'ban-outline'} size={18} color={colors.error} />
                  <Text style={styles.leaveGroupText}>{isBlocked ? 'Unblock User' : 'Block User'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.leaveGroupRow}
                  onPress={() => {
                    setOptionsVisible(false);
                    router.push(`/report-user?target_user_id=${otherUser?.id}`);
                  }}
                  disabled={!otherUser}
                >
                  <Ionicons name="flag-outline" size={18} color={colors.error} />
                  <Text style={styles.leaveGroupText}>Report User</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.leaveGroupRow} onPress={confirmDeleteChat} disabled={leaving}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                  {leaving
                    ? <ActivityIndicator size="small" color={colors.error} />
                    : <Text style={styles.leaveGroupText}>Delete Chat</Text>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.reportSheetTitle}>Group Options</Text>

                <TouchableOpacity style={styles.leaveGroupRow} onPress={confirmLeaveGroup} disabled={leaving}>
                  <Ionicons name="exit-outline" size={18} color={colors.error} />
                  {leaving
                    ? <ActivityIndicator size="small" color={colors.error} />
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
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    groupIconSmall: {
      width: 32, height: 32, borderRadius: 16,
      justifyContent: 'center', alignItems: 'center',
    },
    reportBtn: { padding: 4, width: 26, alignItems: 'flex-end' },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    headerTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', flexShrink: 1 },
    headerSubtitle: { color: colors.textFaint, fontSize: 12, fontWeight: '600', marginTop: 1 },
    messagesList: { padding: 16, paddingBottom: 24 },
    dateSeparatorRow: { alignItems: 'center', marginVertical: 12 },
    dateSeparatorText: {
      color: colors.textTertiary, fontSize: 11, fontWeight: '700',
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMuted,
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
      overflow: 'hidden',
    },
    messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 2 },
    messageRowMine: { justifyContent: 'flex-end' },
    messageRowLast: { marginBottom: 10 },
    avatarSpacer: { width: 28 },
    bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleTheirs: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
    bubbleMine: { backgroundColor: colors.accent },
    bubbleImage: { padding: 0, overflow: 'hidden' },
    senderName: { color: colors.accent, fontSize: 11, fontWeight: '700', marginBottom: 2 },
    senderNameOnImage: { paddingHorizontal: 14, paddingTop: 10 },
    imageBubble: { width: 220, height: 220, borderRadius: 14 },
    imageBubbleCenter: { justifyContent: 'center', alignItems: 'center', gap: 6 },
    imageErrorText: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
    messageText: { fontSize: 14, lineHeight: 20 },
    messageTextMine: { color: '#fff' },
    messageTextTheirs: { color: colors.textPrimary },
    swipeTimeWrap: {
      position: 'absolute', right: 4, top: 0, bottom: 0,
      justifyContent: 'center', alignItems: 'flex-end',
    },
    swipeTimeText: { color: colors.textTertiary, fontSize: 11, fontWeight: '600' },
    seenText: {
      color: colors.textMuted, fontSize: 11, fontWeight: '600',
      textAlign: 'right', marginTop: -6, marginBottom: 8, marginRight: 4,
    },
    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 10,
      paddingHorizontal: 12, paddingTop: 12,
      borderTopWidth: 1, borderTopColor: colors.surfaceAlt,
    },
    input: {
      flex: 1, backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 20,
      paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
      borderWidth: 1, borderColor: colors.border, maxHeight: 100,
    },
    micBtn: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    cameraBtn: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    imagePreviewOverlay: {
      flex: 1, backgroundColor: '#000000ee', justifyContent: 'center', alignItems: 'center',
    },
    imagePreviewCloseBtn: {
      position: 'absolute', top: 56, right: 20, zIndex: 1,
      width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff22',
      justifyContent: 'center', alignItems: 'center',
    },
    imagePreviewFull: { width: '100%', height: '80%' },
    recordingIndicator: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.surfaceAlt, borderRadius: 20,
      paddingHorizontal: 16, paddingVertical: 12,
      borderWidth: 1, borderColor: colors.error + '55',
    },
    recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },
    recordingText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    recordingCancelBtn: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160 },
    audioPlayBtn: {
      width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentMutedStrong,
      justifyContent: 'center', alignItems: 'center',
    },
    audioPlayBtnMine: { backgroundColor: '#ffffff33' },
    audioProgressTrack: {
      flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden',
    },
    audioProgressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
    audioProgressFillMine: { backgroundColor: '#fff' },
    audioDuration: { fontSize: 11, fontWeight: '600' },
    sendBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center',
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
    },
    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    reportSheet: {
      backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34,
      maxHeight: '60%', borderWidth: 1, borderColor: colors.border, borderBottomWidth: 0,
    },
    reportSheetTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 12 },
    leaveGroupRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    leaveGroupText: { color: colors.error, fontSize: 15, fontWeight: '700' },
    blockedBanner: { justifyContent: 'center', gap: 8 },
    blockedBannerText: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
    blockedBannerAction: { color: colors.accent, fontSize: 13, fontWeight: '700' },
    reportSheetSubtitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 4 },
    reportSheetRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border,
    },
    reportSheetRowText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  });
}
