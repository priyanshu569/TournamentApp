import { PermissionsAndroid, Platform } from 'react-native';
import { supabase } from './supabase';

export async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export type LiveKitCredentials = { token: string; url: string };

// Server verifies conversation membership and mints the token -- the
// API secret never reaches the client. Token identity is set to our
// own user_id server-side, so remote participants' LiveKit identity
// IS their Fragify user_id directly.
export async function fetchLiveKitToken(conversationId: string): Promise<LiveKitCredentials> {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: { conversation_id: conversationId },
  });
  if (error || !data?.token) {
    throw new Error(data?.error ?? error?.message ?? 'Could not get a voice chat token.');
  }
  return data as LiveKitCredentials;
}

// Row in voice_room_participants -- this is what lets people who
// haven't joined yet see "N people in voice chat." Once you're
// actually connected, LiveKit's own room state (useParticipants) is
// the live source of truth, not this table.
export async function recordVoicePresence(conversationId: string, userId: string): Promise<void> {
  await supabase
    .from('voice_room_participants')
    .upsert({ conversation_id: conversationId, user_id: userId }, { onConflict: 'conversation_id,user_id' });
}

export async function clearVoicePresence(conversationId: string, userId: string): Promise<void> {
  await supabase.from('voice_room_participants').delete().eq('conversation_id', conversationId).eq('user_id', userId);
}
