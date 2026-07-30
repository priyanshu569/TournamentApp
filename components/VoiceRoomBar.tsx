import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LiveKitRoom, useParticipants, useLocalParticipant } from '@livekit/react-native';
import { supabase } from '@/lib/supabase';
import {
  requestMicPermission, fetchLiveKitToken, recordVoicePresence, clearVoicePresence,
  LiveKitCredentials,
} from '@/lib/voiceCall';
import Avatar from '@/components/Avatar';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function VoiceRoomBar({ conversationId, myId, participantProfiles }: {
  conversationId: string;
  myId: string | null;
  participantProfiles: Map<string, any>;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [presence, setPresence] = useState<{ user_id: string }[]>([]);
  const [joining, setJoining] = useState(false);
  const [credentials, setCredentials] = useState<LiveKitCredentials | null>(null);

  useEffect(() => {
    loadPresence();

    const channel = supabase
      .channel(`voice_room_${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voice_room_participants', filter: `conversation_id=eq.${conversationId}` },
        () => { loadPresence(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Leaving the chat screen leaves the call too -- there's no
  // app-wide "minimized call" bar (yet), so staying "in" a call you
  // can't see or control would be worse than just ending it.
  useEffect(() => {
    return () => {
      if (myId) clearVoicePresence(conversationId, myId);
    };
  }, [conversationId, myId]);

  async function loadPresence() {
    const { data } = await supabase
      .from('voice_room_participants')
      .select('user_id')
      .eq('conversation_id', conversationId);
    setPresence(data ?? []);
  }

  async function handleJoin() {
    if (!myId || joining || credentials) return;
    setJoining(true);
    try {
      const hasMic = await requestMicPermission();
      if (!hasMic) {
        Alert.alert('Microphone access needed', 'Enable microphone access to join voice chat.');
        setJoining(false);
        return;
      }

      const creds = await fetchLiveKitToken(conversationId);
      await recordVoicePresence(conversationId, myId);
      setCredentials(creds);
    } catch (err: any) {
      Alert.alert('Could not join voice chat', err?.message ?? 'Please try again.');
    }
    setJoining(false);
  }

  async function handleLeave() {
    setCredentials(null);
    if (myId) await clearVoicePresence(conversationId, myId);
  }

  const otherCount = presence.filter((p) => p.user_id !== myId).length;

  if (credentials) {
    return (
      <LiveKitRoom
        serverUrl={credentials.url}
        token={credentials.token}
        audio
        connect
        onDisconnected={handleLeave}
        onError={(err) => {
          Alert.alert('Voice chat error', err.message);
          handleLeave();
        }}
      >
        <ActiveCallBar styles={styles} colors={colors} myId={myId} participantProfiles={participantProfiles} onLeave={handleLeave} />
      </LiveKitRoom>
    );
  }

  if (presence.length === 0) {
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

function ActiveCallBar({ styles, colors, myId, participantProfiles, onLeave }: {
  styles: ReturnType<typeof getStyles>;
  colors: ThemeColors;
  myId: string | null;
  participantProfiles: Map<string, any>;
  onLeave: () => void;
}) {
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  function handleToggleMute() {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }

  return (
    <View style={styles.activeBar}>
      <View style={styles.avatarStack}>
        {participants.slice(0, 4).map((p, i) => {
          const profile = p.identity === myId ? null : participantProfiles.get(p.identity);
          return (
            <View key={p.identity} style={[styles.avatarStackItem, { marginLeft: i === 0 ? 0 : -10 }]}>
              <Avatar
                avatarId={profile?.avatar_id}
                avatarUrl={profile?.avatar_url}
                username={p.identity === myId ? 'You' : profile?.display_name}
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
        <Ionicons name={isMicrophoneEnabled ? 'mic' : 'mic-off'} size={18} color={colors.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.leaveBtn} onPress={onLeave}>
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
