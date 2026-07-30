import { createAgoraRtcEngine, ChannelProfileType, IRtcEngine } from 'react-native-agora';
import { PermissionsAndroid, Platform } from 'react-native';
import { supabase } from './supabase';

// One shared engine instance for the app's lifetime -- Agora's SDK is
// meant to be initialized once, not per-call.
let engine: IRtcEngine | null = null;

export async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function getVoiceEngine(appId: string): IRtcEngine {
  if (engine) return engine;
  engine = createAgoraRtcEngine();
  engine.initialize({ appId, channelProfile: ChannelProfileType.ChannelProfileCommunication });
  engine.enableAudio();
  return engine;
}

export type VoiceToken = { token: string; app_id: string; channel: string; uid: number };

// Server verifies conversation membership and mints the token --
// the App Certificate never reaches the client.
export async function fetchVoiceToken(conversationId: string, uid: number): Promise<VoiceToken> {
  const { data, error } = await supabase.functions.invoke('agora-token', {
    body: { conversation_id: conversationId, uid },
  });
  if (error || !data?.token) {
    throw new Error(data?.error ?? error?.message ?? 'Could not get a voice chat token.');
  }
  return data as VoiceToken;
}

// Row in voice_room_participants -- this is what lets every client
// show "N people in voice chat" and map a remote Agora uid (from
// onUserJoined) back to a Fragify profile, since Agora itself only
// knows opaque numeric uids.
export async function recordVoicePresence(conversationId: string, userId: string, uid: number): Promise<void> {
  await supabase
    .from('voice_room_participants')
    .upsert({ conversation_id: conversationId, user_id: userId, agora_uid: uid }, { onConflict: 'conversation_id,user_id' });
}

export async function clearVoicePresence(conversationId: string, userId: string): Promise<void> {
  await supabase.from('voice_room_participants').delete().eq('conversation_id', conversationId).eq('user_id', userId);
}

export function generateVoiceUid(): number {
  // Agora recommends 1 to 2^32-1; avoid 0, which means "let the SDK
  // auto-assign" -- we need a uid we already know before joining.
  return Math.floor(Math.random() * 1_000_000_000) + 1;
}

export function releaseVoiceEngine(): void {
  if (!engine) return;
  try {
    engine.leaveChannel();
  } catch {
    // Already left / never joined -- fine.
  }
  engine.release();
  engine = null;
}
