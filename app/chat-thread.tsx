import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Image,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Alert, Keyboard, Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets, setAudioModeAsync,
  useAudioPlayer, useAudioPlayerStatus, AudioQuality, IOSOutputFormat,
} from 'expo-audio';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import { formatClockTime, formatDayLabel, formatRelativeTime, isSameDay } from '@/lib/time';
import { uploadVoiceMessage, getSignedVoiceMessageUrl, formatAudioDuration } from '@/lib/voiceMessage';
import { pickChatImage, uploadChatImage, getSignedChatImageUrl, saveChatImageToGallery } from '@/lib/chatImage';
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

const IMAGE_BOX_MAX_WIDTH = 240;
const IMAGE_BOX_MAX_HEIGHT = 320;
const IMAGE_BOX_MIN_SIZE = 140;

// Older messages sent before image_width/image_height existed fall
// back to a fixed square rather than stretching/distorting.
function computeImageBoxSize(width?: number | null, height?: number | null) {
  if (!width || !height) return { width: 220, height: 220 };

  const aspect = width / height;
  let boxWidth = IMAGE_BOX_MAX_WIDTH;
  let boxHeight = boxWidth / aspect;

  if (boxHeight > IMAGE_BOX_MAX_HEIGHT) {
    boxHeight = IMAGE_BOX_MAX_HEIGHT;
    boxWidth = boxHeight * aspect;
  }

  boxWidth = Math.max(IMAGE_BOX_MIN_SIZE, boxWidth);
  boxHeight = Math.max(IMAGE_BOX_MIN_SIZE, Math.min(IMAGE_BOX_MAX_HEIGHT, boxHeight));

  return { width: Math.round(boxWidth), height: Math.round(boxHeight) };
}

function replyPreviewSnippet(message: any): string {
  if (message.deleted_at) return 'This message was deleted';
  if (message.image_url) return '📷 Photo';
  if (message.audio_url) return '🎤 Voice message';
  return message.content;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function summarizeReactions(reactions: { user_id: string; emoji: string }[]): string {
  const counts = new Map<string, number>();
  for (const r of reactions) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  }
  return [...counts.entries()].map(([emoji, count]) => (count > 1 ? `${emoji} ${count}` : emoji)).join(' ');
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
  const box = computeImageBoxSize(message.image_width, message.image_height);

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
      <View style={[styles.imageBubble, styles.imageBubbleCenter, box]}>
        <Ionicons name="alert-circle" size={20} color={colors.error} />
        <Text style={styles.imageErrorText}>Couldn't load image</Text>
      </View>
    );
  }

  if (!signedUrl) {
    return (
      <View style={[styles.imageBubble, styles.imageBubbleCenter, box]}>
        <ActivityIndicator size="small" color={isMine ? '#fff' : colors.textPrimary} />
      </View>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(signedUrl)}>
      <Image source={{ uri: signedUrl }} style={[styles.imageBubble, box]} resizeMode="cover" />
    </TouchableOpacity>
  );
}

function MessageBubble({
  message, isMine, showAvatar, showSenderName, senderName, senderAvatarId, senderAvatarUrl,
  swipeX, seenLabel, styles, colors, onImagePress, replyToMessage, replyToSenderName,
  reactions, onSwipeReply, onLongPressMessage, onReplyPreviewPress,
}: {
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
  replyToMessage: any | null;
  replyToSenderName: string;
  reactions: { user_id: string; emoji: string }[];
  onSwipeReply: (message: any) => void;
  onLongPressMessage: (message: any, isMine: boolean, y: number) => void;
  onReplyPreviewPress: (replyToId: string) => void;
}) {
  const bubbleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));
  const timeAnimStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(swipeX.value) / 36),
  }));

  const replySwipeX = useSharedValue(0);
  const rowSwipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: replySwipeX.value }],
  }));
  const replyHintStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, replySwipeX.value / 40),
  }));

  const isDeleted = !!message.deleted_at;

  const replySwipeGesture = Gesture.Pan()
    .activeOffsetX([15, 999])
    .failOffsetY([-10, 10])
    .enabled(!isDeleted)
    .onUpdate((e) => {
      replySwipeX.value = Math.max(0, Math.min(64, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX > 50) {
        scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
        scheduleOnRN(onSwipeReply, message);
      }
      replySwipeX.value = withSpring(0, { damping: 20, stiffness: 200 });
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(280)
    .enabled(!isDeleted)
    .onStart((e) => {
      scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
      scheduleOnRN(onLongPressMessage, message, isMine, e.absoluteY);
    });

  return (
    <View>
      <GestureDetector gesture={replySwipeGesture}>
        <Animated.View style={[styles.messageRow, isMine && styles.messageRowMine, showAvatar && styles.messageRowLast, rowSwipeStyle]}>
          <Animated.View style={[styles.replyHint, replyHintStyle]} pointerEvents="none">
            <Ionicons name="arrow-undo" size={16} color={colors.accent} />
          </Animated.View>
          {!isMine && (
            showAvatar
              ? <Avatar avatarId={senderAvatarId} avatarUrl={senderAvatarUrl} username={senderName} size={28} />
              : <View style={styles.avatarSpacer} />
          )}
          <View style={styles.bubbleWrap}>
            <GestureDetector gesture={longPressGesture}>
              <Animated.View style={[
                styles.bubble,
                isMine ? styles.bubbleMine : styles.bubbleTheirs,
                message.image_url && styles.bubbleImage,
                isDeleted && styles.bubbleDeleted,
                bubbleAnimStyle,
              ]}>
                {showSenderName && !isDeleted && (
                  <Text style={[styles.senderName, message.image_url && styles.senderNameOnImage]}>{senderName}</Text>
                )}
                {replyToMessage && !isDeleted && (
                  <TouchableOpacity
                    style={[styles.replyPreview, isMine && styles.replyPreviewMine]}
                    onPress={() => onReplyPreviewPress(message.reply_to_id)}
                  >
                    <Text style={[styles.replyPreviewName, isMine && styles.replyPreviewNameMine]} numberOfLines={1}>
                      {replyToSenderName}
                    </Text>
                    <Text style={[styles.replyPreviewText, isMine && styles.replyPreviewTextMine]} numberOfLines={1}>
                      {replyPreviewSnippet(replyToMessage)}
                    </Text>
                  </TouchableOpacity>
                )}
                {isDeleted ? (
                  <View style={styles.deletedRow}>
                    <Ionicons name="ban-outline" size={13} color={isMine ? '#ffffffaa' : colors.textFaint} />
                    <Text style={[styles.deletedText, isMine && styles.deletedTextMine]}>This message was deleted</Text>
                  </View>
                ) : message.image_url ? (
                  <ImageMessage message={message} isMine={isMine} styles={styles} colors={colors} onPress={onImagePress} />
                ) : message.audio_url ? (
                  <VoiceMessagePlayer message={message} isMine={isMine} styles={styles} colors={colors} />
                ) : (
                  <>
                    {message.is_forwarded && (
                      <View style={styles.forwardedRow}>
                        <Ionicons name="arrow-redo-outline" size={11} color={isMine ? '#ffffffaa' : colors.textFaint} />
                        <Text style={[styles.forwardedText, isMine && styles.forwardedTextMine]}>Forwarded</Text>
                      </View>
                    )}
                    <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextTheirs]}>{message.content}</Text>
                  </>
                )}
              </Animated.View>
            </GestureDetector>
            {reactions.length > 0 && (
              <View style={[styles.reactionPill, isMine && styles.reactionPillMine]}>
                <Text style={styles.reactionPillText}>{summarizeReactions(reactions)}</Text>
              </View>
            )}
          </View>
          <Animated.View style={[styles.swipeTimeWrap, timeAnimStyle]} pointerEvents="none">
            <Text style={styles.swipeTimeText}>{formatClockTime(message.created_at)}</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      {seenLabel && (
        <Text style={styles.seenText}>{seenLabel}</Text>
      )}
    </View>
  );
}

export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, theme } = useAppTheme();
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
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [activeMenu, setActiveMenu] = useState<{ message: any; isMine: boolean; y: number } | null>(null);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [reactionsByMessage, setReactionsByMessage] = useState<Map<string, { user_id: string; emoji: string }[]>>(new Map());
  const [myDeletions, setMyDeletions] = useState<Set<string>>(new Set());
  const [forwardMessage, setForwardMessage] = useState<any>(null);
  const [forwardTargets, setForwardTargets] = useState<any[]>([]);
  const [forwarding, setForwarding] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
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

  useEffect(() => {
    const channel = supabase
      .channel(`message_reactions_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        loadReactions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  const rows = useMemo(() => {
    const result: any[] = [];
    let lastDate: string | null = null;
    const visible = messages.filter((m) => !myDeletions.has(m.id));
    for (const m of visible) {
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
  }, [messages, myDeletions]);

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

      const { data: deletions } = await supabase
        .from('message_deletions')
        .select('message_id')
        .eq('user_id', me)
        .in('message_id', (msgs ?? []).map((m: any) => m.id));
      setMyDeletions(new Set((deletions ?? []).map((d: any) => d.message_id)));
    }

    await loadReactions();
  }

  async function loadReactions() {
    const { data } = await supabase
      .from('message_reactions')
      .select('message_id, user_id, emoji, messages!inner(conversation_id)')
      .eq('messages.conversation_id', id);

    const map = new Map<string, { user_id: string; emoji: string }[]>();
    for (const r of (data ?? []) as any[]) {
      const list = map.get(r.message_id) ?? [];
      list.push({ user_id: r.user_id, emoji: r.emoji });
      map.set(r.message_id, list);
    }
    setReactionsByMessage(map);
  }

  async function handleSend() {
    if (!text.trim() || !myId) return;
    setSending(true);

    const { error } = await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: myId,
      content: text.trim(),
      reply_to_id: replyingTo?.id ?? null,
    });

    if (!error) {
      setText('');
      setReplyingTo(null);
    } else {
      console.log('Failed to send message:', error.message);
      Alert.alert('Message not sent', friendlySendError(error.message));
    }
    setSending(false);
  }

  async function handleSaveImage() {
    if (!previewImageUrl) return;
    setSavingImage(true);
    try {
      await saveChatImageToGallery(previewImageUrl);
      Alert.alert('Saved', 'Photo saved to your gallery.');
    } catch (err: any) {
      Alert.alert('Could not save photo', err?.message ?? 'Please try again.');
    }
    setSavingImage(false);
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
        image_width: picked.width,
        image_height: picked.height,
        reply_to_id: replyingTo?.id ?? null,
      });
      if (error) throw error;
      setReplyingTo(null);
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
        reply_to_id: replyingTo?.id ?? null,
      });
      if (error) throw error;
      setReplyingTo(null);
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

  function handleReplyPreviewPress(replyToId: string) {
    const target = rows.find((r) => r.type === 'message' && r.id === replyToId);
    if (target) {
      listRef.current?.scrollToItem({ item: target, animated: true });
    }
  }

  function handleLongPressMessage(message: any, isMine: boolean, y: number) {
    setActiveMenu({ message, isMine, y });
    setMoreExpanded(false);
  }

  function closeMenu() {
    setActiveMenu(null);
    setMoreExpanded(false);
  }

  async function handleReact(emoji: string) {
    if (!myId || !activeMenu) return;
    const messageId = activeMenu.message.id;
    const mine = reactionsByMessage.get(messageId)?.find((r) => r.user_id === myId);
    closeMenu();

    if (mine?.emoji === emoji) {
      await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', myId);
    } else {
      await supabase
        .from('message_reactions')
        .upsert({ message_id: messageId, user_id: myId, emoji }, { onConflict: 'message_id,user_id' });
    }
  }

  function handleMenuReply() {
    if (!activeMenu) return;
    setReplyingTo(activeMenu.message);
    closeMenu();
  }

  function handleMenuForward() {
    if (!activeMenu) return;
    const message = activeMenu.message;
    closeMenu();
    openForwardPicker(message);
  }

  async function handleMenuCopy() {
    if (!activeMenu) return;
    await Clipboard.setStringAsync(activeMenu.message.content);
    closeMenu();
  }

  function handleMenuDelete() {
    if (!activeMenu) return;
    const { message, isMine } = activeMenu;
    closeMenu();

    if (isMine) {
      Alert.alert('Delete Message?', 'Choose how you want to delete this message.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete for You', onPress: () => deleteMessageForMe(message.id) },
        { text: 'Unsend for Everyone', style: 'destructive', onPress: () => unsendMessage(message.id) },
      ]);
    } else {
      Alert.alert('Delete Message?', 'This only removes it from your view.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMessageForMe(message.id) },
      ]);
    }
  }

  async function deleteMessageForMe(messageId: string) {
    if (!myId) return;
    const { error } = await supabase.from('message_deletions').insert({ message_id: messageId, user_id: myId });
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setMyDeletions((prev) => new Set(prev).add(messageId));
  }

  async function unsendMessage(messageId: string) {
    const { error } = await supabase.rpc('unsend_message', { p_message_id: messageId });
    if (error) Alert.alert('Error', error.message);
  }

  async function handleMenuPin() {
    if (!activeMenu) return;
    const messageId = activeMenu.message.id;
    closeMenu();
    const { error } = await supabase.rpc('toggle_pinned_message', { p_message_id: messageId });
    if (error) Alert.alert('Error', error.message);
  }

  function handleMenuReport() {
    if (!activeMenu) return;
    const message = activeMenu.message;
    closeMenu();
    router.push(`/report-user?target_user_id=${message.sender_id}&target_message_id=${message.id}`);
  }

  async function openForwardPicker(message: any) {
    if (!myId) return;
    setForwardMessage(message);

    const { data: participantRows } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', myId);

    const conversationIds = (participantRows ?? [])
      .map((p: any) => p.conversation_id)
      .filter((cid: string) => cid !== id);

    if (conversationIds.length === 0) {
      setForwardTargets([]);
      return;
    }

    const { data: convos } = await supabase
      .from('conversations')
      .select('id, conversation_type, name')
      .in('id', conversationIds);

    const directConvoIds = (convos ?? []).filter((c: any) => c.conversation_type === 'direct').map((c: any) => c.id);

    const { data: otherParticipants } = directConvoIds.length > 0
      ? await supabase
          .from('conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', directConvoIds)
          .neq('user_id', myId)
      : { data: [] };

    const otherUserIds = [...new Set((otherParticipants ?? []).map((p: any) => p.user_id))];
    const { data: profiles } = otherUserIds.length > 0
      ? await supabase.from('public_profiles').select('id, display_name, avatar_id, avatar_url').in('id', otherUserIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const otherUserByConvo = new Map((otherParticipants ?? []).map((p: any) => [p.conversation_id, p.user_id]));

    const targets = (convos ?? []).map((c: any) => {
      if (c.conversation_type === 'direct') {
        const otherId = otherUserByConvo.get(c.id);
        const profile = otherId ? profileMap.get(otherId) : null;
        return {
          id: c.id, name: profile?.display_name ?? 'Unknown',
          avatarId: profile?.avatar_id ?? null, avatarUrl: profile?.avatar_url ?? null, isGroup: false,
        };
      }
      return { id: c.id, name: c.name ?? 'Group Chat', avatarId: null, avatarUrl: null, isGroup: true };
    });

    setForwardTargets(targets);
  }

  async function handleForwardTo(targetConversationId: string) {
    if (!myId || !forwardMessage) return;
    setForwarding(true);
    try {
      const message = forwardMessage;
      let imageUrl: string | null = null;
      let audioUrl: string | null = null;

      if (message.image_url) {
        imageUrl = `${targetConversationId}/${myId}/${Date.now()}.jpg`;
        const { error } = await supabase.storage.from('chat-images').copy(message.image_url, imageUrl);
        if (error) throw error;
      }
      if (message.audio_url) {
        audioUrl = `${targetConversationId}/${myId}/${Date.now()}.m4a`;
        const { error } = await supabase.storage.from('chat-audio').copy(message.audio_url, audioUrl);
        if (error) throw error;
      }

      const { error } = await supabase.from('messages').insert({
        conversation_id: targetConversationId,
        sender_id: myId,
        content: message.content,
        image_url: imageUrl,
        image_width: message.image_width ?? null,
        image_height: message.image_height ?? null,
        audio_url: audioUrl,
        audio_duration_seconds: message.audio_duration_seconds ?? null,
        is_forwarded: true,
      });
      if (error) throw error;

      setForwardMessage(null);
      Alert.alert('Forwarded', 'Message forwarded.');
    } catch (err: any) {
      Alert.alert('Could not forward', err?.message ?? 'Please try again.');
    }
    setForwarding(false);
  }

  async function handleUnpin(messageId: string) {
    const { error } = await supabase.rpc('toggle_pinned_message', { p_message_id: messageId });
    if (error) Alert.alert('Error', error.message);
  }

  const pinnedMessage = useMemo(() => {
    const pinned = messages.filter((m) => m.pinned_at);
    if (pinned.length === 0) return null;
    return pinned.reduce((a, b) => (new Date(a.pinned_at) > new Date(b.pinned_at) ? a : b));
  }, [messages]);

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

        {pinnedMessage && (
          <TouchableOpacity style={styles.pinnedBanner} onPress={() => handleReplyPreviewPress(pinnedMessage.id)}>
            <Ionicons name="pin" size={14} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pinnedBannerLabel}>Pinned message</Text>
              <Text style={styles.pinnedBannerText} numberOfLines={1}>{replyPreviewSnippet(pinnedMessage)}</Text>
            </View>
            <TouchableOpacity onPress={() => handleUnpin(pinnedMessage.id)} style={styles.pinnedBannerClose}>
              <Ionicons name="close" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

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
              const replyToMessage = item.reply_to_id ? messagesById.get(item.reply_to_id) ?? null : null;
              const replyToSender = replyToMessage ? participantProfiles.get(replyToMessage.sender_id) : null;
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
                  replyToMessage={replyToMessage}
                  replyToSenderName={
                    replyToMessage?.sender_id === myId ? 'You' : replyToSender?.display_name ?? 'Unknown'
                  }
                  reactions={reactionsByMessage.get(item.id) ?? []}
                  onSwipeReply={setReplyingTo}
                  onLongPressMessage={handleLongPressMessage}
                  onReplyPreviewPress={handleReplyPreviewPress}
                />
              );
            }}
          />
        </GestureDetector>

        {replyingTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarAccent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBarName}>
                {replyingTo.sender_id === myId ? 'You' : (participantProfiles.get(replyingTo.sender_id)?.display_name ?? 'Unknown')}
              </Text>
              <Text style={styles.replyBarSnippet} numberOfLines={1}>{replyPreviewSnippet(replyingTo)}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyBarClose}>
              <Ionicons name="close" size={18} color={colors.textFaint} />
            </TouchableOpacity>
          </View>
        )}

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
          style={[styles.imagePreviewOverlay, { backgroundColor: theme === 'dark' ? '#000' : '#fff' }]}
          activeOpacity={1}
          onPress={() => setPreviewImageUrl(null)}
        >
          <View style={styles.imagePreviewTopBar}>
            <TouchableOpacity
              style={[styles.imagePreviewIconBtn, { backgroundColor: theme === 'dark' ? '#ffffff22' : '#00000014' }]}
              onPress={() => setPreviewImageUrl(null)}
            >
              <Ionicons name="close" size={24} color={theme === 'dark' ? '#fff' : '#000'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imagePreviewIconBtn, { backgroundColor: theme === 'dark' ? '#ffffff22' : '#00000014' }]}
              onPress={handleSaveImage}
              disabled={savingImage}
            >
              {savingImage
                ? <ActivityIndicator size="small" color={theme === 'dark' ? '#fff' : '#000'} />
                : <Ionicons name="download-outline" size={22} color={theme === 'dark' ? '#fff' : '#000'} />
              }
            </TouchableOpacity>
          </View>
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

      <Modal visible={!!activeMenu} transparent animationType="fade" onRequestClose={closeMenu}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={closeMenu}>
          {activeMenu && (
            <View style={[
              styles.menuWrap,
              {
                top: Math.min(
                  Math.max(activeMenu.y - 60, 80),
                  Dimensions.get('window').height - (moreExpanded ? 420 : 320)
                ),
              },
              activeMenu.isMine ? { alignItems: 'flex-end', right: 16 } : { alignItems: 'flex-start', left: 16 },
            ]}>
              <View style={styles.reactionRow}>
                {REACTION_EMOJIS.map((emoji) => (
                  <TouchableOpacity key={emoji} style={styles.reactionOption} onPress={() => handleReact(emoji)}>
                    <Text style={styles.reactionOptionText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.menuCard}>
                <TouchableOpacity style={styles.menuItem} onPress={handleMenuReply}>
                  <Ionicons name="arrow-undo-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.menuItemText}>Reply</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleMenuForward}>
                  <Ionicons name="arrow-redo-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.menuItemText}>Forward</Text>
                </TouchableOpacity>

                {!activeMenu.message.image_url && !activeMenu.message.audio_url && (
                  <TouchableOpacity style={styles.menuItem} onPress={handleMenuCopy}>
                    <Ionicons name="copy-outline" size={18} color={colors.textPrimary} />
                    <Text style={styles.menuItemText}>Copy</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.menuItem} onPress={handleMenuDelete}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                  <Text style={[styles.menuItemText, { color: colors.error }]}>Delete</Text>
                </TouchableOpacity>

                {!moreExpanded ? (
                  <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={() => setMoreExpanded(true)}>
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.textPrimary} />
                    <Text style={styles.menuItemText}>More</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity style={styles.menuItem} onPress={handleMenuPin}>
                      <Ionicons name={activeMenu.message.pinned_at ? 'pin' : 'pin-outline'} size={18} color={colors.textPrimary} />
                      <Text style={styles.menuItemText}>{activeMenu.message.pinned_at ? 'Unpin' : 'Pin'}</Text>
                    </TouchableOpacity>
                    {!activeMenu.isMine && (
                      <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={handleMenuReport}>
                        <Ionicons name="flag-outline" size={18} color={colors.textPrimary} />
                        <Text style={styles.menuItemText}>Report</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={!!forwardMessage}
        transparent
        animationType="slide"
        onRequestClose={() => setForwardMessage(null)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setForwardMessage(null)}>
          <View style={styles.reportSheet}>
            <Text style={styles.reportSheetTitle}>Forward to...</Text>
            {forwardTargets.length === 0 ? (
              <Text style={styles.reportSheetSubtitle}>No other conversations to forward to.</Text>
            ) : (
              forwardTargets.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.reportSheetRow}
                  onPress={() => handleForwardTo(t.id)}
                  disabled={forwarding}
                >
                  {t.isGroup ? (
                    <View style={styles.forwardGroupIcon}>
                      <Ionicons name="people" size={16} color="#fff" />
                    </View>
                  ) : (
                    <Avatar avatarId={t.avatarId} avatarUrl={t.avatarUrl} username={t.name} size={32} />
                  )}
                  <Text style={[styles.reportSheetRowText, { flex: 1, marginLeft: 10 }]}>{t.name}</Text>
                  {forwarding
                    ? <ActivityIndicator size="small" color={colors.accent} />
                    : <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  }
                </TouchableOpacity>
              ))
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
    replyHint: { position: 'absolute', left: 2, bottom: 8 },
    // maxWidth lives here, not on `bubble` -- this View is messageRow's
    // direct flex child (a definite width to resolve % against), and
    // alignItems:flex-start stops the bubble from stretching to fill
    // this wrapper's own (content-sized, circularly-undetermined)
    // width, which was collapsing text to wrap one character per line.
    bubbleWrap: { maxWidth: '78%', alignItems: 'flex-start' },
    bubble: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleTheirs: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
    bubbleMine: { backgroundColor: colors.accent },
    bubbleImage: { padding: 0, overflow: 'hidden', borderWidth: 0 },
    bubbleDeleted: { opacity: 0.6 },
    senderName: { color: colors.accent, fontSize: 11, fontWeight: '700', marginBottom: 2 },
    senderNameOnImage: { paddingHorizontal: 14, paddingTop: 10 },
    imageBubble: { borderRadius: 14 },
    imageBubbleCenter: { justifyContent: 'center', alignItems: 'center', gap: 6 },
    imageErrorText: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
    messageText: { fontSize: 14, lineHeight: 20 },
    messageTextMine: { color: '#fff' },
    messageTextTheirs: { color: colors.textPrimary },
    deletedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    deletedText: { fontSize: 13, fontStyle: 'italic', color: colors.textFaint },
    deletedTextMine: { color: '#ffffffcc' },
    forwardedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
    forwardedText: { fontSize: 11, fontStyle: 'italic', color: colors.textFaint },
    forwardedTextMine: { color: '#ffffffaa' },
    replyPreview: {
      borderLeftWidth: 3, borderLeftColor: colors.accent,
      backgroundColor: colors.overlay, borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6,
    },
    replyPreviewMine: { borderLeftColor: '#fff', backgroundColor: '#ffffff26' },
    replyPreviewName: { color: colors.accent, fontSize: 12, fontWeight: '700' },
    replyPreviewNameMine: { color: '#fff' },
    replyPreviewText: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
    replyPreviewTextMine: { color: '#ffffffdd' },
    reactionPill: {
      position: 'absolute', bottom: -10, left: 10,
      backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 6, paddingVertical: 2,
    },
    reactionPillMine: { left: undefined, right: 10 },
    reactionPillText: { fontSize: 12 },
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
      flex: 1, justifyContent: 'center', alignItems: 'center',
    },
    imagePreviewTopBar: {
      position: 'absolute', top: 56, left: 20, right: 20, zIndex: 1,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    imagePreviewIconBtn: {
      width: 40, height: 40, borderRadius: 20,
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
    replyBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.surfaceAlt, paddingHorizontal: 14, paddingVertical: 8,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    replyBarAccent: { width: 3, height: 30, borderRadius: 2, backgroundColor: colors.accent },
    replyBarName: { color: colors.accent, fontSize: 12, fontWeight: '700' },
    replyBarSnippet: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
    replyBarClose: { padding: 4 },
    reportSheetSubtitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 4 },
    reportSheetRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border,
    },
    reportSheetRowText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    menuOverlay: { flex: 1, backgroundColor: colors.overlay },
    menuWrap: { position: 'absolute', width: 240 },
    reactionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 8, paddingVertical: 6, marginBottom: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
    },
    reactionOption: { padding: 4 },
    reactionOptionText: { fontSize: 22 },
    menuCard: {
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      width: 200, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
    },
    menuItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    menuItemLast: { borderBottomWidth: 0 },
    menuItemText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    forwardGroupIcon: {
      width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent,
      justifyContent: 'center', alignItems: 'center',
    },
    pinnedBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingVertical: 8,
      backgroundColor: colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: colors.borderMuted,
    },
    pinnedBannerLabel: { color: colors.accent, fontSize: 11, fontWeight: '700' },
    pinnedBannerText: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
    pinnedBannerClose: { padding: 4 },
  });
}
