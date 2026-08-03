import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Image, ScrollView, Share, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import VerifiedBadge from '@/components/VerifiedBadge';
import { formatRelativeTime } from '@/lib/time';
import { getWorldChatReplyRetryMessage } from '@/lib/worldChatRateLimit';
import { getDesignation } from '@/lib/designation';
import { useAvatarPreview } from '@/lib/AvatarPreviewContext';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const MAX_LENGTH = 1000;
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const KEYBOARD_EMOJIS = [
  '😀', '😂', '🥰', '😎', '🤔', '😭', '😡', '😴',
  '😅', '🥳', '😜', '🤯', '😱', '🙄', '😇', '🤗',
  '👍', '👎', '👏', '🙏', '💪', '🙌', '👀', '🤝',
  '❤️', '🔥', '💯', '🎉', '⚡', '✅', '❌', '🏆',
];

function topReactions(reactions: { user_id: string; emoji: string }[], max = 3): { emoji: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([emoji, count]) => ({ emoji, count }));
}

export default function WorldChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const showAvatarPreview = useAvatarPreview();
  const [post, setPost] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [reactions, setReactions] = useState<{ user_id: string; emoji: string }[]>([]);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [reactionGridOpen, setReactionGridOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string } | null>(null);

  useEffect(() => { loadThread(); }, [id]);

  useEffect(() => {
    const channel = supabase
      .channel(`world_chat_replies_${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'world_chat_replies', filter: `post_id=eq.${id}` },
        () => { loadReplies(); }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'world_chat_replies', filter: `post_id=eq.${id}` },
        (payload) => {
          setReplies((prev) => prev.filter((r) => r.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'world_chat_post_reactions', filter: `post_id=eq.${id}` },
        () => { loadReactions(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'world_chat_reply_likes' },
        () => { loadReplies(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function onRefresh() {
    setRefreshing(true);
    await loadThread();
    setRefreshing(false);
  }

  async function loadThread() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id ?? null;
    setMyId(me);

    if (me) {
      const { data: myProfile } = await supabase
        .from('Profiles')
        .select('is_admin')
        .eq('id', me)
        .single();
      setIsAdmin(!!myProfile?.is_admin);

      const { data: saveRow } = await supabase
        .from('world_chat_post_saves')
        .select('id')
        .eq('post_id', id)
        .eq('user_id', me)
        .maybeSingle();
      setIsSaved(!!saveRow);
    }

    const { data: postRow, error } = await supabase
      .from('world_chat_posts')
      .select('id, author_id, content, image_url, image_width, image_height, created_at')
      .eq('id', id)
      .single();

    if (error || !postRow) {
      setLoading(false);
      return;
    }

    const { data: authorProfile } = await supabase
      .from('public_profiles')
      .select('id, username, display_name, avatar_id, avatar_url, is_verified, role, is_admin')
      .eq('id', postRow.author_id)
      .single();

    setPost({ ...postRow, author: authorProfile });

    await Promise.all([loadReplies(), loadReactions()]);
    setLoading(false);
  }

  async function loadReplies() {
    const { data: rows } = await supabase
      .from('world_chat_replies')
      .select('id, author_id, content, reply_to_id, created_at')
      .eq('post_id', id)
      .order('created_at', { ascending: true });

    const replyRows = rows ?? [];
    const authorIds = [...new Set(replyRows.map((r) => r.author_id))];
    const replyIds = replyRows.map((r) => r.id);

    const [{ data: profiles }, { data: likeRows }] = await Promise.all([
      authorIds.length > 0
        ? supabase.from('public_profiles').select('id, username, display_name, avatar_id, avatar_url, is_verified, role, is_admin').in('id', authorIds)
        : Promise.resolve({ data: [] }),
      replyIds.length > 0
        ? supabase.from('world_chat_reply_likes').select('reply_id, user_id').in('reply_id', replyIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const byId = new Map(replyRows.map((r: any) => [r.id, r]));
    const likesMap = new Map<string, string[]>();
    for (const l of (likeRows ?? []) as any[]) {
      const list = likesMap.get(l.reply_id) ?? [];
      list.push(l.user_id);
      likesMap.set(l.reply_id, list);
    }

    setReplies(replyRows.map((r: any) => ({
      ...r,
      author: profileMap.get(r.author_id) ?? null,
      replyToAuthorName: r.reply_to_id
        ? (profileMap.get(byId.get(r.reply_to_id)?.author_id)?.display_name ?? null)
        : null,
      likeUserIds: likesMap.get(r.id) ?? [],
    })));
  }

  async function loadReactions() {
    const { data } = await supabase
      .from('world_chat_post_reactions')
      .select('user_id, emoji')
      .eq('post_id', id);
    setReactions(data ?? []);
  }

  async function toggleReplyLike(replyId: string) {
    if (!myId) return;
    const reply = replies.find((r) => r.id === replyId);
    const isLiked = !!reply?.likeUserIds.includes(myId);

    setReplies((prev) => prev.map((r) => r.id === replyId
      ? { ...r, likeUserIds: isLiked ? r.likeUserIds.filter((u: string) => u !== myId) : [...r.likeUserIds, myId] }
      : r
    ));

    if (isLiked) {
      await supabase.from('world_chat_reply_likes').delete().eq('reply_id', replyId).eq('user_id', myId);
    } else {
      await supabase.from('world_chat_reply_likes').insert({ reply_id: replyId, user_id: myId });
    }
  }

  async function toggleSave() {
    if (!myId) return;
    const next = !isSaved;
    setIsSaved(next);
    if (next) {
      await supabase.from('world_chat_post_saves').insert({ post_id: id, user_id: myId });
    } else {
      await supabase.from('world_chat_post_saves').delete().eq('post_id', id).eq('user_id', myId);
    }
  }

  async function sharePost() {
    try {
      await Share.share({
        message: `${post?.author?.display_name ?? 'Someone'} on Fragify World Chat: ${post?.content || '📷 Photo post'}`,
      });
    } catch { /* user dismissed the share sheet */ }
  }

  function quickReact() {
    const mine = reactions.find((r) => r.user_id === myId);
    handleReact(mine?.emoji ?? '❤️');
  }

  async function handleReact(emoji: string) {
    setReactionPickerOpen(false);
    setReactionGridOpen(false);
    if (!myId) return;

    const mine = reactions.find((r) => r.user_id === myId);

    setReactions((prev) => {
      const rest = prev.filter((r) => r.user_id !== myId);
      return (!mine || mine.emoji !== emoji) ? [...rest, { user_id: myId, emoji }] : rest;
    });

    if (mine && mine.emoji === emoji) {
      await supabase.from('world_chat_post_reactions').delete().eq('post_id', id).eq('user_id', myId);
    } else {
      await supabase.from('world_chat_post_reactions').upsert(
        { post_id: id, user_id: myId, emoji },
        { onConflict: 'post_id,user_id' }
      );
    }
  }

  async function handleReply() {
    const trimmed = text.trim();
    if (!trimmed || !myId) return;
    setPosting(true);

    const { error } = await supabase.from('world_chat_replies').insert({
      post_id: id,
      author_id: myId,
      content: trimmed,
      reply_to_id: replyingTo?.id ?? null,
    });

    setPosting(false);

    if (error) {
      const friendly = error.message.includes('row-level security')
        ? await getWorldChatReplyRetryMessage(myId)
        : error.message;
      Alert.alert('Could not reply', friendly);
      return;
    }

    setText('');
    setReplyingTo(null);
  }

  function confirmDeleteReply(replyId: string) {
    Alert.alert('Delete Reply?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('world_chat_replies').delete().eq('id', replyId);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            setReplies((prev) => prev.filter((r) => r.id !== replyId));
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textPrimary }}>Post not found — it may have been deleted.</Text>
      </View>
    );
  }

  const remaining = MAX_LENGTH - text.length;
  const top3 = topReactions(reactions);

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
          <Text style={styles.headerTitle}>Post</Text>
          {post.author_id !== myId ? (
            <TouchableOpacity onPress={() => router.push(`/report-user?target_post_id=${post.id}`)} style={styles.backBtn}>
              <Ionicons name="flag-outline" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        <FlatList
          data={replies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
          ListHeaderComponent={
            <View style={styles.postCard}>
              <TouchableOpacity
                style={styles.authorRow}
                onPress={() => router.push(`/user-profile?id=${post.author_id}`)}
                onLongPress={() => showAvatarPreview({ avatarId: post.author?.avatar_id, avatarUrl: post.author?.avatar_url, username: post.author?.display_name })}
              >
                <Avatar avatarId={post.author?.avatar_id} avatarUrl={post.author?.avatar_url} username={post.author?.display_name} size={40} />
                <View>
                  <View style={styles.authorNameRow}>
                    <Text style={styles.authorName}>{post.author?.display_name ?? 'Unknown'}</Text>
                    {post.author?.is_verified && <VerifiedBadge size={13} />}
                  </View>
                  <View style={styles.postMetaRow}>
                    <Text style={[styles.postDesignation, { color: getDesignation(post.author, colors).color }]}>
                      {getDesignation(post.author, colors).label}
                    </Text>
                    <Text style={styles.postMetaDot}>·</Text>
                    <Text style={styles.postTime}>{formatRelativeTime(post.created_at)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {!!post.content && <Text style={styles.postContent}>{post.content}</Text>}
              {post.image_url && (
                <Image
                  source={{ uri: post.image_url }}
                  style={[
                    styles.postImage,
                    post.image_width && post.image_height
                      ? { aspectRatio: post.image_width / post.image_height }
                      : { aspectRatio: 1 },
                  ]}
                  resizeMode="cover"
                />
              )}

              <View style={styles.postFooter}>
                <TouchableOpacity
                  style={styles.footerLeft}
                  onPress={quickReact}
                  onLongPress={() => setReactionPickerOpen((v) => !v)}
                >
                  {reactions.length === 0 ? (
                    <>
                      <Ionicons name="heart-outline" size={17} color={colors.textFaint} />
                      <Text style={styles.postFooterText}>Like</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.topEmojisText}>{top3.map((t) => t.emoji).join('')}</Text>
                      <Text style={styles.postFooterText}>{reactions.length}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.footerBtn} onPress={sharePost}>
                  <Ionicons name="paper-plane-outline" size={16} color={colors.textFaint} />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={styles.footerBtn} onPress={toggleSave}>
                  <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={17} color={isSaved ? colors.accent : colors.textFaint} />
                </TouchableOpacity>
              </View>

              {reactionPickerOpen && (
                <View style={styles.reactionStrip}>
                  {REACTION_EMOJIS.map((emoji) => (
                    <TouchableOpacity key={emoji} style={styles.reactionOption} onPress={() => handleReact(emoji)}>
                      <Text style={styles.reactionOptionText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.reactionMoreOption} onPress={() => { setReactionPickerOpen(false); setReactionGridOpen(true); }}>
                    <Ionicons name="add" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
              {reactionGridOpen && (
                <View style={styles.emojiGridBox}>
                  <ScrollView contentContainerStyle={styles.emojiGridWrap}>
                    {KEYBOARD_EMOJIS.map((emoji, index) => (
                      <TouchableOpacity key={`${emoji}-${index}`} style={styles.emojiGridItem} onPress={() => handleReact(emoji)}>
                        <Text style={styles.emojiGridItemText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.divider} />
              <Text style={styles.repliesLabel}>
                {replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}` : 'No replies yet'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const canDelete = item.author_id === myId || isAdmin;
            const designation = getDesignation(item.author, colors);
            const liked = myId ? item.likeUserIds.includes(myId) : false;
            return (
              <View style={[styles.replyCard, item.reply_to_id && styles.replyCardNested]}>
                <TouchableOpacity
                  style={styles.authorRow}
                  onPress={() => router.push(`/user-profile?id=${item.author_id}`)}
                  onLongPress={() => showAvatarPreview({ avatarId: item.author?.avatar_id, avatarUrl: item.author?.avatar_url, username: item.author?.display_name })}
                >
                  <Avatar avatarId={item.author?.avatar_id} avatarUrl={item.author?.avatar_url} username={item.author?.display_name} size={30} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.authorNameRow}>
                      <Text style={styles.replyAuthorName}>{item.author?.display_name ?? 'Unknown'}</Text>
                      {item.author?.is_verified && <VerifiedBadge size={11} />}
                      <Text style={[styles.replyDesignation, { color: designation.color }]}>· {designation.label}</Text>
                      <Text style={styles.replyTime}>· {formatRelativeTime(item.created_at)}</Text>
                    </View>
                    {item.replyToAuthorName && (
                      <Text style={styles.replyToTag}>↳ replying to {item.replyToAuthorName}</Text>
                    )}
                    <Text style={styles.replyContent}>{item.content}</Text>
                    <View style={styles.commentFooter}>
                      <TouchableOpacity style={styles.commentLikeBtn} onPress={() => toggleReplyLike(item.id)}>
                        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={13} color={liked ? colors.error : colors.textFaint} />
                        {item.likeUserIds.length > 0 && <Text style={styles.commentLikeCount}>{item.likeUserIds.length}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setReplyingTo({ id: item.id, authorName: item.author?.display_name ?? 'Unknown' })}>
                        <Text style={styles.commentReplyLink}>Reply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {canDelete && (
                    <TouchableOpacity onPress={() => confirmDeleteReply(item.id)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={15} color={colors.textFaint} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          {replyingTo && (
            <View style={styles.replyingToBar}>
              <Text style={styles.replyingToText} numberOfLines={1}>Replying to {replyingTo.authorName}</Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Ionicons name="close" size={16} color={colors.textFaint} />
              </TouchableOpacity>
            </View>
          )}
          <TextInput
            style={styles.composerInput}
            placeholder={replyingTo ? `Reply to ${replyingTo.authorName}...` : 'Write a reply...'}
            placeholderTextColor={colors.textDisabled}
            value={text}
            onChangeText={(t) => setText(t.slice(0, MAX_LENGTH))}
            multiline
          />
          <View style={styles.composerFooter}>
            <Text style={[styles.charCount, remaining < 60 && styles.charCountLow]}>{remaining}</Text>
            <TouchableOpacity
              style={styles.postBtn}
              onPress={handleReply}
              disabled={posting || !text.trim()}
            >
              {posting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.postBtnText}>Reply</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.borderMuted,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
    listContent: { padding: 16, paddingBottom: 24 },
    postCard: {
      backgroundColor: colors.surface, borderRadius: 16, padding: 16,
      marginBottom: 14, borderWidth: 1, borderColor: colors.borderMuted,
    },
    authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    authorName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    postTime: { color: colors.textFaint, fontSize: 12, marginTop: 1 },
    postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
    postDesignation: { fontSize: 12, fontWeight: '700' },
    postMetaDot: { color: colors.textFaint, fontSize: 12 },
    postContent: { color: colors.textPrimary, fontSize: 16, lineHeight: 22, marginTop: 14 },
    postImage: { width: '100%', borderRadius: 14, marginTop: 14, backgroundColor: colors.surfaceAlt },
    postFooter: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    postFooterText: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
    topEmojisText: { fontSize: 15 },
    reactionStrip: {
      flexDirection: 'row', gap: 6, marginTop: 10, padding: 8, alignItems: 'center',
      backgroundColor: colors.surfaceAlt, borderRadius: 14, alignSelf: 'flex-start',
    },
    reactionOption: { paddingHorizontal: 6, paddingVertical: 2 },
    reactionOptionText: { fontSize: 20 },
    reactionMoreOption: {
      width: 28, height: 28, borderRadius: 14, marginLeft: 2,
      justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface,
    },
    emojiGridBox: { marginTop: 10, backgroundColor: colors.surfaceAlt, borderRadius: 14, maxHeight: 180 },
    emojiGridWrap: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
    emojiGridItem: { width: '12.5%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
    emojiGridItemText: { fontSize: 22 },
    divider: { height: 1, backgroundColor: colors.border, marginTop: 16, marginBottom: 10 },
    repliesLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
    replyCard: {
      backgroundColor: colors.surface, borderRadius: 14, padding: 12,
      marginBottom: 8, borderWidth: 1, borderColor: colors.borderMuted,
    },
    replyCardNested: { marginLeft: 24, borderColor: colors.accentMutedStrong },
    replyAuthorName: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
    replyDesignation: { fontSize: 11, fontWeight: '700', marginLeft: 2 },
    replyTime: { color: colors.textFaint, fontSize: 11, marginLeft: 2 },
    replyToTag: { color: colors.accent, fontSize: 11, fontWeight: '600', marginTop: 2 },
    replyContent: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
    commentFooter: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
    commentLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    commentLikeCount: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
    commentReplyLink: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
    deleteBtn: { padding: 4 },
    composer: {
      borderTopWidth: 1, borderTopColor: colors.borderMuted,
      padding: 12, paddingBottom: 20, backgroundColor: colors.surface,
    },
    replyingToBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
    },
    replyingToText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
    composerInput: {
      backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
      borderWidth: 1, borderColor: colors.border, maxHeight: 120, minHeight: 52,
    },
    composerFooter: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8,
    },
    charCount: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
    charCountLow: { color: colors.warning },
    postBtn: {
      backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 9,
      borderRadius: 18, minWidth: 70, alignItems: 'center',
    },
    postBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  });
}
