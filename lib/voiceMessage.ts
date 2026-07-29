import { supabase } from './supabase';

// Bucket is private (unlike the avatar/banner buckets) -- voice
// messages carry the same privacy expectation as the text messages
// they replace. Path structure "{conversationId}/{senderId}/{ts}.m4a"
// is what the storage RLS policies check membership against.
export async function uploadVoiceMessage(
  conversationId: string,
  senderId: string,
  localUri: string
): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const path = `${conversationId}/${senderId}/${Date.now()}.m4a`;

  const { error } = await supabase.storage
    .from('chat-audio')
    .upload(path, blob, { contentType: 'audio/m4a' });

  if (error) throw error;
  return path;
}

export async function getSignedVoiceMessageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('chat-audio')
    .createSignedUrl(path, 3600);

  if (error) throw error;
  return data.signedUrl;
}

export function formatAudioDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
