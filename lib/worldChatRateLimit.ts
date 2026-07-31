import { supabase } from './supabase';

const DAY_MS = 24 * 60 * 60 * 1000;
const REPLY_WINDOW_MINUTES = 10;
const REPLY_WINDOW_MS = REPLY_WINDOW_MINUTES * 60 * 1000;

function formatWait(remainingMs: number): string {
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Mirrors the RLS checks in 20260731160000_add_world_chat_images_and_reactions.sql:
// 10 posts/day, plus 1 image-post/day counted separately. Since the
// caller already knows whether this attempt included an image, that
// tells us which cap was actually hit.
export async function getWorldChatPostRetryMessage(userId: string, hadImage: boolean): Promise<string> {
  const since = new Date(Date.now() - DAY_MS).toISOString();

  if (hadImage) {
    const { data } = await supabase
      .from('world_chat_posts')
      .select('created_at')
      .eq('author_id', userId)
      .not('image_url', 'is', null)
      .gt('created_at', since)
      .order('created_at', { ascending: true })
      .limit(1);

    if (data?.[0]?.created_at) {
      const remainingMs = DAY_MS - (Date.now() - new Date(data[0].created_at).getTime());
      if (remainingMs > 0) {
        return `You can only post 1 photo per day — try again in ${formatWait(remainingMs)}.`;
      }
    }
  }

  const { data } = await supabase
    .from('world_chat_posts')
    .select('created_at')
    .eq('author_id', userId)
    .gt('created_at', since)
    .order('created_at', { ascending: true })
    .limit(1);

  const oldest = data?.[0]?.created_at;
  if (!oldest) {
    return "You've reached today's posting limit — please try again later.";
  }

  const remainingMs = DAY_MS - (Date.now() - new Date(oldest).getTime());
  if (remainingMs <= 0) {
    return "You've reached today's posting limit — please try again in a moment.";
  }

  return `You've reached today's limit of 10 posts — try again in ${formatWait(remainingMs)}.`;
}

// Replies keep the original lighter "10 per 10 minutes" limit.
export async function getWorldChatReplyRetryMessage(userId: string): Promise<string> {
  const { data } = await supabase
    .from('world_chat_replies')
    .select('created_at')
    .eq('author_id', userId)
    .gt('created_at', new Date(Date.now() - REPLY_WINDOW_MS).toISOString())
    .order('created_at', { ascending: true })
    .limit(1);

  const oldest = data?.[0]?.created_at;
  if (!oldest) {
    return "You're posting too fast — please wait a few minutes and try again.";
  }

  const remainingMs = REPLY_WINDOW_MS - (Date.now() - new Date(oldest).getTime());
  if (remainingMs <= 0) {
    return "You're posting too fast — please try again in a moment.";
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const label = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  return `You're posting too fast — you can post again in ${label}.`;
}
