import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Image, ScrollView, Share,
  TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import VerifiedBadge from '@/components/VerifiedBadge';
import ImageCropPreview from '@/components/ImageCropPreview';
import { formatRelativeTime } from '@/lib/time';
import { getWorldChatPostRetryMessage } from '@/lib/worldChatRateLimit';
import { uploadWorldChatImage } from '@/lib/worldChatImage';
import { pickRawChatImage, resizeAndCompress, PickedChatImage, RawImage } from '@/lib/chatImage';
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

export default function WorldChatScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const showAvatarPreview = useAvatarPreview();
  const [posts, setPosts] = useState<any[]>([]);
  const [reactionsByPost, setReactionsByPost] = useState<Map<string, { user_id: string; emoji: string }[]>>(new Map());
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [reactionGridFor, setReactionGridFor] = useState<string | null>(null);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [viewingSaved, setViewingSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [pendingImage, setPendingImage] = useState<PickedChatImage | null>(null);
  const [rawPickedImage, setRawPickedImage] = useState<RawImage | null>(null);
  const viewingSavedRef = useRef(false);
  const listRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
      loadSavedIds();

      const channel = supabase
        .channel('world_chat_posts_feed')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'world_chat_posts' },
          () => { if (!viewingSavedRef.current) loadPosts(); }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'world_chat_posts' },
          (payload) => {
            setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'world_chat_post_reactions' },
          () => { if (!viewingSavedRef.current) loadPosts(); }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }, [])
  );

  async function loadSavedIds() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id;
    if (!me) return;
    const { data } = await supabase.from('world_chat_post_saves').select('post_id').eq('user_id', me);
    setSavedPostIds(new Set((data ?? []).map((r: any) => r.post_id)));
  }

  async function loadPosts(idsFilter?: string[]) {
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
    }

    if (idsFilter && idsFilter.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from('world_chat_posts')
      .select('id, author_id, content, image_url, image_width, image_height, created_at');

    query = idsFilter ? query.in('id', idsFilter) : query.order('created_at', { ascending: false }).limit(100);

    const { data: rows, error } = await query;

    if (error) {
      console.log('Failed to load world chat:', error.message);
      setLoading(false);
      return;
    }

    const postRows = rows ?? [];
    const authorIds = [...new Set(postRows.map((p) => p.author_id))];
    const postIds = postRows.map((p) => p.id);

    const [{ data: profiles }, { data: replyRows }, { data: reactionRows }] = await Promise.all([
      authorIds.length > 0
        ? supabase.from('public_profiles').select('id, username, display_name, avatar_id, avatar_url, is_verified, role, is_admin').in('id', authorIds)
        : Promise.resolve({ data: [] }),
      postIds.length > 0
        ? supabase.from('world_chat_replies').select('post_id').in('post_id', postIds)
        : Promise.resolve({ data: [] }),
      postIds.length > 0
        ? supabase.from('world_chat_post_reactions').select('post_id, user_id, emoji').in('post_id', postIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const replyCountMap = new Map<string, number>();
    for (const r of replyRows ?? []) {
      replyCountMap.set(r.post_id, (replyCountMap.get(r.post_id) ?? 0) + 1);
    }

    const reactionMap = new Map<string, { user_id: string; emoji: string }[]>();
    for (const r of (reactionRows ?? []) as any[]) {
      const list = reactionMap.get(r.post_id) ?? [];
      list.push({ user_id: r.user_id, emoji: r.emoji });
      reactionMap.set(r.post_id, list);
    }
    setReactionsByPost(reactionMap);

    const built = postRows.map((p) => ({
      ...p,
      author: profileMap.get(p.author_id) ?? null,
      replyCount: replyCountMap.get(p.id) ?? 0,
    }));

    if (idsFilter) built.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setPosts(built);
    setLoading(false);
  }

  async function toggleSavedView() {
    const next = !viewingSaved;
    setViewingSaved(next);
    viewingSavedRef.current = next;
    setLoading(true);

    if (next) {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      const { data: saves } = me
        ? await supabase.from('world_chat_post_saves').select('post_id').eq('user_id', me)
        : { data: [] };
      await loadPosts((saves ?? []).map((s: any) => s.post_id));
    } else {
      await loadPosts();
    }
  }

  async function toggleSave(postId: string) {
    if (!myId) return;
    const isSaved = savedPostIds.has(postId);

    setSavedPostIds((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(postId) : next.add(postId);
      return next;
    });
    if (viewingSaved && isSaved) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }

    if (isSaved) {
      await supabase.from('world_chat_post_saves').delete().eq('post_id', postId).eq('user_id', myId);
    } else {
      await supabase.from('world_chat_post_saves').insert({ post_id: postId, user_id: myId });
    }
  }

  async function sharePost(item: any) {
    try {
      await Share.share({
        message: `${item.author?.display_name ?? 'Someone'} on Fragify World Chat: ${item.content || '📷 Photo post'}`,
      });
    } catch { /* user dismissed the share sheet */ }
  }

  async function handlePickImage(source: 'camera' | 'library') {
    try {
      const raw = await pickRawChatImage(source);
      if (raw) setRawPickedImage(raw);
    } catch (err: any) {
      Alert.alert('Could not open image', err?.message ?? 'Please try again.');
    }
  }

  async function handleCropConfirm(cropped: RawImage) {
    setRawPickedImage(null);
    const compressed = await resizeAndCompress(cropped.uri, cropped.width, cropped.height);
    setPendingImage(compressed);
  }

  function showImageSourcePicker() {
    Alert.alert('Add a Photo', 'You can share 1 photo per day.', [
      { text: 'Take Photo', onPress: () => handlePickImage('camera') },
      { text: 'Choose from Gallery', onPress: () => handlePickImage('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handlePost() {
    const trimmed = text.trim();
    if ((!trimmed && !pendingImage) || !myId) return;
    setPosting(true);

    const hadImage = !!pendingImage;
    let imagePayload: { image_url: string; image_width: number; image_height: number } | null = null;

    try {
      if (pendingImage) {
        const url = await uploadWorldChatImage(myId, pendingImage.base64);
        imagePayload = { image_url: url, image_width: pendingImage.width, image_height: pendingImage.height };
      }

      const { error } = await supabase.from('world_chat_posts').insert({
        author_id: myId,
        content: trimmed,
        ...imagePayload,
      });

      if (error) throw error;

      setText('');
      setPendingImage(null);
      if (viewingSaved) {
        // Switches back to the main feed and reloads it -- a fresh post
        // can never already be saved, so staying on "Saved" would leave
        // the header/bookmark state saying "Saved" while showing the
        // normal feed underneath it.
        await toggleSavedView();
      } else {
        loadPosts();
      }
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch (err: any) {
      const friendly = err.message?.includes('row-level security')
        ? await getWorldChatPostRetryMessage(myId, hadImage)
        : err.message;
      Alert.alert('Could not post', friendly);
    }

    setPosting(false);
  }

  function confirmDelete(postId: string) {
    Alert.alert('Delete Post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('world_chat_posts').delete().eq('id', postId);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            setPosts((prev) => prev.filter((p) => p.id !== postId));
          }
        },
      },
    ]);
  }

  function reportPost(postId: string) {
    router.push(`/report-user?target_post_id=${postId}`);
  }

  async function handleReact(postId: string, emoji: string) {
    setReactionPickerFor(null);
    setReactionGridFor(null);
    if (!myId) return;

    const mine = (reactionsByPost.get(postId) ?? []).find((r) => r.user_id === myId);

    setReactionsByPost((prev) => {
      const next = new Map(prev);
      const list = (next.get(postId) ?? []).filter((r) => r.user_id !== myId);
      if (!mine || mine.emoji !== emoji) list.push({ user_id: myId, emoji });
      next.set(postId, list);
      return next;
    });

    if (mine && mine.emoji === emoji) {
      await supabase.from('world_chat_post_reactions').delete().eq('post_id', postId).eq('user_id', myId);
    } else {
      await supabase.from('world_chat_post_reactions').upsert(
        { post_id: postId, user_id: myId, emoji },
        { onConflict: 'post_id,user_id' }
      );
    }
  }

  function quickReact(postId: string) {
    const mine = (reactionsByPost.get(postId) ?? []).find((r) => r.user_id === myId);
    handleReact(postId, mine?.emoji ?? '❤️');
  }

  const remaining = MAX_LENGTH - text.length;

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
          <View style={styles.headerTitleRow}>
            <LinearGradient colors={['#2E9BFF', '#0F5FA6']} style={styles.headerIcon}>
              <Ionicons name="globe" size={18} color="#fff" />
            </LinearGradient>
            <Text style={styles.headerTitle}>{viewingSaved ? 'Saved Posts' : 'World Chat'}</Text>
          </View>
          <TouchableOpacity onPress={toggleSavedView} style={styles.backBtn}>
            <Ionicons name={viewingSaved ? 'bookmark' : 'bookmark-outline'} size={19} color={viewingSaved ? colors.accent : colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={posts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name={viewingSaved ? 'bookmark-outline' : 'globe-outline'} size={32} color={colors.textDisabled} />
                <Text style={styles.emptyText}>
                  {viewingSaved ? "You haven't saved any posts yet." : 'No posts yet. Be the first to say something!'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const canDelete = item.author_id === myId || isAdmin;
              const designation = getDesignation(item.author, colors);
              const reactions = reactionsByPost.get(item.id) ?? [];
              const top3 = topReactions(reactions);
              const pickerOpen = reactionPickerFor === item.id;
              const gridOpen = reactionGridFor === item.id;
              const isSaved = savedPostIds.has(item.id);
              return (
                <View style={styles.postCard}>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => router.push(`/world-chat-thread?id=${item.id}`)}>
                    <View style={styles.postHeader}>
                      <TouchableOpacity
                        style={styles.postAuthorRow}
                        onPress={(e) => { e.stopPropagation(); router.push(`/user-profile?id=${item.author_id}`); }}
                        onLongPress={(e) => { e.stopPropagation(); showAvatarPreview({ avatarId: item.author?.avatar_id, avatarUrl: item.author?.avatar_url, username: item.author?.display_name }); }}
                      >
                        <Avatar avatarId={item.author?.avatar_id} avatarUrl={item.author?.avatar_url} username={item.author?.display_name} size={36} />
                        <View>
                          <View style={styles.postAuthorNameRow}>
                            <Text style={styles.postAuthorName}>{item.author?.display_name ?? 'Unknown'}</Text>
                            {item.author?.is_verified && <VerifiedBadge size={12} />}
                          </View>
                          <View style={styles.postMetaRow}>
                            <Text style={[styles.postDesignation, { color: designation.color }]}>{designation.label}</Text>
                            <Text style={styles.postMetaDot}>·</Text>
                            <Text style={styles.postTime}>{formatRelativeTime(item.created_at)}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                      <View style={styles.headerActions}>
                        {item.author_id !== myId && (
                          <TouchableOpacity
                            style={styles.headerActionBtn}
                            onPress={(e) => { e.stopPropagation(); reportPost(item.id); }}
                          >
                            <Ionicons name="flag-outline" size={15} color={colors.textFaint} />
                          </TouchableOpacity>
                        )}
                        {canDelete && (
                          <TouchableOpacity
                            style={styles.headerActionBtn}
                            onPress={(e) => { e.stopPropagation(); confirmDelete(item.id); }}
                          >
                            <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {!!item.content && <Text style={styles.postContent}>{item.content}</Text>}
                    {item.image_url && (
                      <Image
                        source={{ uri: item.image_url }}
                        style={[
                          styles.postImage,
                          item.image_width && item.image_height
                            ? { aspectRatio: item.image_width / item.image_height }
                            : { aspectRatio: 1 },
                        ]}
                        resizeMode="cover"
                      />
                    )}
                  </TouchableOpacity>

                  <View style={styles.postFooter}>
                    <TouchableOpacity
                      style={styles.footerLeft}
                      onPress={() => quickReact(item.id)}
                      onLongPress={() => setReactionPickerFor(pickerOpen ? null : item.id)}
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
                    <TouchableOpacity style={styles.footerBtn} onPress={() => router.push(`/world-chat-thread?id=${item.id}`)}>
                      <Ionicons name="chatbubble-outline" size={16} color={colors.textFaint} />
                      {item.replyCount > 0 && <Text style={styles.postFooterText}>{item.replyCount}</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.footerBtn} onPress={() => sharePost(item)}>
                      <Ionicons name="paper-plane-outline" size={16} color={colors.textFaint} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity style={styles.footerBtn} onPress={() => toggleSave(item.id)}>
                      <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={17} color={isSaved ? colors.accent : colors.textFaint} />
                    </TouchableOpacity>
                  </View>

                  {pickerOpen && (
                    <View style={styles.reactionStrip}>
                      {REACTION_EMOJIS.map((emoji) => (
                        <TouchableOpacity key={emoji} style={styles.reactionOption} onPress={() => handleReact(item.id, emoji)}>
                          <Text style={styles.reactionOptionText}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity style={styles.reactionMoreOption} onPress={() => { setReactionPickerFor(null); setReactionGridFor(item.id); }}>
                        <Ionicons name="add" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {gridOpen && (
                    <View style={styles.emojiGridBox}>
                      <ScrollView contentContainerStyle={styles.emojiGridWrap}>
                        {KEYBOARD_EMOJIS.map((emoji, index) => (
                          <TouchableOpacity key={`${emoji}-${index}`} style={styles.emojiGridItem} onPress={() => handleReact(item.id, emoji)}>
                            <Text style={styles.emojiGridItemText}>{emoji}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              );
            }}
          />
        )}

        <View style={styles.composer}>
          {pendingImage && (
            <View style={styles.pendingImageRow}>
              <Image source={{ uri: `data:image/jpeg;base64,${pendingImage.base64}` }} style={styles.pendingImageThumb} />
              <Text style={styles.pendingImageText}>Photo attached</Text>
              <TouchableOpacity onPress={() => setPendingImage(null)} style={styles.pendingImageRemove}>
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.composerRow}>
            <TouchableOpacity style={styles.composerCameraBtn} onPress={showImageSourcePicker} disabled={!!pendingImage}>
              <Ionicons name="camera" size={20} color={pendingImage ? colors.textDisabled : colors.accent} />
            </TouchableOpacity>
            <TextInput
              style={styles.composerInput}
              placeholder="Say something to everyone..."
              placeholderTextColor={colors.textDisabled}
              value={text}
              onChangeText={(t) => setText(t.slice(0, MAX_LENGTH))}
              multiline
            />
            <TouchableOpacity
              style={[styles.postBtn, (posting || (!text.trim() && !pendingImage)) && styles.postBtnDisabled]}
              onPress={handlePost}
              disabled={posting || (!text.trim() && !pendingImage)}
            >
              {posting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.postBtnText}>Post</Text>
              }
            </TouchableOpacity>
          </View>
          <Text style={[styles.charCount, remaining < 60 && styles.charCountLow]}>{remaining}</Text>
        </View>
      </View>

      <ImageCropPreview
        visible={!!rawPickedImage}
        image={rawPickedImage}
        onCancel={() => setRawPickedImage(null)}
        onConfirm={handleCropConfirm}
      />
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.borderMuted,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerIcon: {
      width: 30, height: 30, borderRadius: 15,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
    listContent: { padding: 16, paddingBottom: 24 },
    emptyContainer: { alignItems: 'center', gap: 12, marginTop: 60, paddingHorizontal: 30 },
    emptyText: { color: colors.textFaint, textAlign: 'center' },
    postCard: {
      backgroundColor: colors.surface, borderRadius: 16, padding: 14,
      marginBottom: 10, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2, shadowRadius: 6, elevation: 2,
    },
    postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    postAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    postAuthorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    postAuthorName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    postTime: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
    postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
    postDesignation: { fontSize: 11, fontWeight: '700' },
    postMetaDot: { color: colors.textFaint, fontSize: 11 },
    headerActions: { flexDirection: 'row', gap: 4 },
    headerActionBtn: { padding: 4 },
    postContent: { color: colors.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 10 },
    postImage: { width: '100%', borderRadius: 12, marginTop: 10, backgroundColor: colors.surfaceAlt },
    postFooter: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    postFooterText: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
    topEmojisText: { fontSize: 15 },
    reactionStrip: {
      flexDirection: 'row', gap: 6, marginTop: 10, padding: 8,
      backgroundColor: colors.surfaceAlt, borderRadius: 14, alignSelf: 'flex-start', alignItems: 'center',
    },
    reactionOption: { paddingHorizontal: 6, paddingVertical: 2 },
    reactionOptionText: { fontSize: 20 },
    reactionMoreOption: {
      width: 28, height: 28, borderRadius: 14, marginLeft: 2,
      justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface,
    },
    emojiGridBox: {
      marginTop: 10, backgroundColor: colors.surfaceAlt, borderRadius: 14, maxHeight: 180,
    },
    emojiGridWrap: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
    emojiGridItem: { width: '12.5%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
    emojiGridItemText: { fontSize: 22 },
    composer: {
      borderTopWidth: 1, borderTopColor: colors.borderMuted,
      padding: 12, paddingBottom: 20, backgroundColor: colors.surface,
    },
    composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    composerCameraBtn: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    composerInput: {
      flex: 1, backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
      borderWidth: 1, borderColor: colors.border, maxHeight: 120, minHeight: 52,
    },
    pendingImageRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 8, marginBottom: 8,
      borderWidth: 1, borderColor: colors.border,
    },
    pendingImageThumb: { width: 40, height: 40, borderRadius: 8 },
    pendingImageText: { flex: 1, color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    pendingImageRemove: { padding: 4 },
    charCount: { color: colors.textFaint, fontSize: 11, fontWeight: '600', textAlign: 'right', marginTop: 6 },
    charCountLow: { color: colors.warning },
    postBtn: {
      backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 12,
      borderRadius: 20, minHeight: 40, justifyContent: 'center', alignItems: 'center',
    },
    postBtnDisabled: { opacity: 0.5 },
    postBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  });
}
