import { supabase } from './supabase';
import { notifyAndLog, sendPushNotification } from './notifications';

// Accepts a pending message request (recipient side) and lets the
// original sender know, so they're not left wondering.
export async function acceptMessageRequest(conversationId: string, myDisplayName: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('accept_message_request', { p_conversation_id: conversationId });
  if (error) return { error: error.message };

  const { data: targets } = await supabase.rpc('get_conversation_notify_targets', { p_conversation_id: conversationId });
  const other = (targets ?? [])[0];
  if (other?.push_token) {
    await notifyAndLog(
      other.user_id, other.push_token,
      'Message Request Accepted', `${myDisplayName} accepted your message request`,
      undefined, conversationId
    );
  }
  return { error: null };
}

// Declining is just leaving the conversation before ever accepting it --
// same delete already used for "Leave Group" / "Delete Chat".
export async function declineMessageRequest(conversationId: string, myId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('conversation_participants')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', myId);
  return { error: error?.message ?? null };
}

// Fans a push out to every other participant after a message is sent.
// Muted/opted-out participants are excluded server-side. A still-pending
// recipient gets a one-off logged "new message request" notification
// instead of the normal push-only chat ping. Fire-and-forget -- never
// blocks or fails the send itself.
export async function notifyConversationParticipants(
  conversationId: string,
  senderDisplayName: string,
  groupName: string | null,
  preview: string,
) {
  const { data: targets, error } = await supabase.rpc('get_conversation_notify_targets', { p_conversation_id: conversationId });
  if (error || !targets) return;

  const title = groupName ? `${senderDisplayName} in ${groupName}` : senderDisplayName;

  await Promise.all(targets.map(async (t: any) => {
    if (!t.push_token) return;
    if (t.is_pending) {
      await notifyAndLog(
        t.user_id, t.push_token,
        'New Message Request', `${senderDisplayName} wants to send you a message`,
        undefined, conversationId
      );
    } else {
      await sendPushNotification([t.push_token], title, preview, { conversation_id: conversationId });
    }
  }));
}
