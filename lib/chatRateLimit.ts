import { supabase } from './supabase';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatWait(remainingMs: number): string {
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Mirrors the RLS checks in 20260731190000_add_chat_rate_limits_and_admin_exemptions.sql:
// 60 messages/minute, plus 4 image messages/day counted separately.
// isBlocked is passed in rather than re-derived here since chat-thread
// already tracks it client-side and it's the far more common rejection
// reason -- no point re-deriving something already known.
export async function getChatSendRetryMessage(userId: string, hadImage: boolean, isBlocked: boolean): Promise<string> {
  if (isBlocked) return "You can't send messages in this conversation.";

  if (hadImage) {
    const { data } = await supabase
      .from('messages')
      .select('created_at')
      .eq('sender_id', userId)
      .not('image_url', 'is', null)
      .gt('created_at', new Date(Date.now() - DAY_MS).toISOString())
      .order('created_at', { ascending: true })
      .limit(1);

    if (data?.[0]?.created_at) {
      const remainingMs = DAY_MS - (Date.now() - new Date(data[0].created_at).getTime());
      if (remainingMs > 0) {
        return `You can only share 4 photos per day — try again in ${formatWait(remainingMs)}.`;
      }
    }
  }

  const { data } = await supabase
    .from('messages')
    .select('created_at')
    .eq('sender_id', userId)
    .gt('created_at', new Date(Date.now() - MINUTE_MS).toISOString())
    .order('created_at', { ascending: true })
    .limit(1);

  const oldest = data?.[0]?.created_at;
  if (!oldest) {
    return "You're sending messages too fast — please slow down.";
  }

  const remainingMs = MINUTE_MS - (Date.now() - new Date(oldest).getTime());
  if (remainingMs <= 0) {
    return "You're sending messages too fast — please try again in a moment.";
  }

  return `You're sending messages too fast — try again in ${Math.ceil(remainingMs / 1000)}s.`;
}
