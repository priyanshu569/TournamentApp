import { supabase } from './supabase';

const WINDOW_MINUTES = 10;
const WINDOW_MS = WINDOW_MINUTES * 60 * 1000;

// Mirrors the RLS "< 10 posts in the last 10 minutes" check in
// 20260729023457_add_world_chat.sql: the wait is measured from the
// oldest post still inside that rolling window, not from the last one.
export async function getWorldChatRetryMessage(
  table: 'world_chat_posts' | 'world_chat_replies',
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from(table)
    .select('created_at')
    .eq('author_id', userId)
    .gt('created_at', new Date(Date.now() - WINDOW_MS).toISOString())
    .order('created_at', { ascending: true })
    .limit(1);

  const oldest = data?.[0]?.created_at;
  if (!oldest) {
    return "You're posting too fast — please wait a few minutes and try again.";
  }

  const remainingMs = WINDOW_MS - (Date.now() - new Date(oldest).getTime());
  if (remainingMs <= 0) {
    return "You're posting too fast — please try again in a moment.";
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const label = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  return `You're posting too fast — you can post again in ${label}.`;
}
