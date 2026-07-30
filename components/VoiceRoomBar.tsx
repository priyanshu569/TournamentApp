import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IRtcEngine, IRtcEngineEventHandler } from 'react-native-agora';
import { supabase } from '@/lib/supabase';
import {
  requestMicPermission, getVoiceEngine, fetchVoiceToken, recordVoicePresence,
  clearVoicePresence, generateVoiceUid, releaseVoiceEngine,
} from '@/lib/voiceCall';
import Avatar from '@/components/Avatar';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

type VoiceParticipant = { user_id: string; agora_uid: number };

export default function VoiceRoomBar({ conversationId, myId, participantProfiles }: {
  conversationId: string;
  myId: string | null;
  participantProfiles: Map<string, any>;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [inCall, setInCall] = useState(false);
  const [joining, setJoining] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const myUidRef = useRef<number | null>(null);
  const handlerRef = useRef<IRtcEngineEventHandler | null>(null);
  const engineRef = useRef<IRtcEngine | null>(null);

  useEffect(() => {
    loadParticipants();

    const channel = supabase
      .channel(`voice_room_${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voice_room_participants', filter: `conversation_id=eq.${conversationId}` },
        () => { loadParticipants(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Leaving the chat screen leaves the call too -- there's no
  // app-wide "minimized call" bar (yet), so staying "in" a call you
  // can't see or control would be worse than just ending it.
  useEffect(() => {
    return () => {
      if (myUidRef.current !== null && myId) {
        clearVoicePresence(conversationId, myId);
      }
      if (handlerRef.current && engineRef.current) {
        engineRef.current.unregisterEventHandler(handlerRef.current);
      }
      releaseVoiceEngine();
    };
  }, [conversationId, myId]);

  async function loadParticipants() {
    const { data } = await supabase
      .from('voice_room_participants')
      .select('user_id, agora_uid')
      .eq('conversation_id', conversationId);
    setParticipants(data ?? []);
  }

  async function handleJoin() {
    if (!myId || joining || inCall) return;
    setJoining(true);
    try {
      const hasMic = await requestMicPermission();
      if (!hasMic) {
        Alert.alert('Microphone access needed', 'Enable microphone access to join voice chat.');
        setJoining(false);
        return;
      }

      const uid = generateVoiceUid();
      const voiceToken = await fetchVoiceToken(conversationId, uid);
      const rtcEngine = getVoiceEngine(voiceToken.app_id);
      engineRef.current = rtcEngine;

      const handler: IRtcEngineEventHandler = {
        onError: (err, msg) => console.log('Agora error:', err, msg),
      };
      rtcEngine.registerEventHandler(handler);
      handlerRef.current = handler;

      const result = rtcEngine.joinChannel(voiceToken.token, conversationId, uid, {
        publishMicrophoneTrack: true,
        autoSubscribeAudio: true,
      });
      if (result !== 0) throw new Error('Failed to join voice chat.');

      myUidRef.current = uid;
      await recordVoicePresence(conversationId, myId, uid);
      setInCall(true);
      setMicMuted(false);
    } catch (err: any) {
      Alert.alert('Could not join voice chat', err?.message ?? 'Please try again.');
    }
    setJoining(false);
  }

  async function handleLeave() {
    if (!myId) return;
    if (handlerRef.current && engineRef.current) {
      engineRef.current.unregisterEventHandler(handlerRef.current);
      handlerRef.current = null;
    }
    releaseVoiceEngine();
    engineRef.current = null;
    myUidRef.current = null;
    setInCall(false);
    await clearVoicePresence(conversationId, myId);
  }

  function handleToggleMute() {
    if (!engineRef.current) return;
    const next = !micMuted;
    engineRef.current.muteLocalAudioStream(next);
    setMicMuted(next);
  }

  const otherCount = participants.filter((p) => p.user_id !== myId).length;

  if (!inCall && participants.length === 0) {
    return (
      <TouchableOpacity style={styles.idleBar} onPress={handleJoin} disabled={joining}>
        <Ionicons name="mic-outline" size={16} color={colors.accent} />
        {joining
          ? <ActivityIndicator size="small" color={colors.accent} />
          : <Text style={styles.idleBarText}>Start Voice Chat</Text>
        }
      </TouchableOpacity>
    );
  }

  if (!inCall) {
    return (
      <TouchableOpacity style={styles.idleBar} onPress={handleJoin} disabled={joining}>
        <View style={styles.liveDot} />
        {joining
          ? <ActivityIndicator size="small" color={colors.accent} />
          : (
            <Text style={styles.idleBarText}>
              {otherCount} in voice chat — tap to join
            </Text>
          )
        }
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.activeBar}>
      <View style={styles.avatarStack}>
        {participants.slice(0, 4).map((p, i) => {
          const profile = p.user_id === myId ? null : participantProfiles.get(p.user_id);
          return (
            <View key={p.user_id} style={[styles.avatarStackItem, { marginLeft: i === 0 ? 0 : -10 }]}>
              <Avatar
                avatarId={profile?.avatar_id}
                avatarUrl={profile?.avatar_url}
                username={p.user_id === myId ? 'You' : profile?.display_name}
                size={28}
              />
            </View>
          );
        })}
      </View>
      <Text style={styles.activeBarText}>
        {participants.length} in voice chat
      </Text>
      <TouchableOpacity style={styles.micBtn} onPress={handleToggleMute}>
        <Ionicons name={micMuted ? 'mic-off' : 'mic'} size={18} color={colors.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
        <Ionicons name="call" size={16} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
      </TouchableOpacity>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    idleBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 8, backgroundColor: colors.surfaceAlt,
      borderBottomWidth: 1, borderBottomColor: colors.borderMuted,
    },
    idleBarText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
    activeBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.surfaceAlt,
      borderBottomWidth: 1, borderBottomColor: colors.borderMuted,
    },
    avatarStack: { flexDirection: 'row', alignItems: 'center' },
    avatarStackItem: { borderRadius: 16, borderWidth: 2, borderColor: colors.surfaceAlt },
    activeBarText: { flex: 1, color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
    micBtn: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center',
    },
    leaveBtn: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: colors.error,
      justifyContent: 'center', alignItems: 'center',
    },
  });
}
