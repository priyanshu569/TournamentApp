import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import VerifiedBadge from '@/components/VerifiedBadge';
import { formatRelativeTime } from '@/lib/time';
import { getWorldChatRetryMessage } from '@/lib/worldChatRateLimit';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const MAX_LENGTH = 300;

export default function WorldChatScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const listRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      loadPosts();

      const channel = supabase
        .channel('world_chat_posts_feed')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'world_chat_posts' },
          () => { loadPosts(); }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'world_chat_posts' },
          (payload) => {
            setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }, [])
  );

  async function loadPosts() {
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

    const { data: rows, error } = await supabase
      .from('world_chat_posts')
      .select('id, author_id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.log('Failed to load world chat:', error.message);
      setLoading(false);
      return;
    }

    const postRows = rows ?? [];
    const authorIds = [...new Set(postRows.map((p) => p.author_id))];
    const postIds = postRows.map((p) => p.id);

    const [{ data: profiles }, { data: replyRows }] = await Promise.all([
      authorIds.length > 0
        ? supabase.from('public_profiles').select('id, username, display_name, avatar_id, avatar_url, is_verified').in('id', authorIds)
        : Promise.resolve({ data: [] }),
      postIds.length > 0
        ? supabase.from('world_chat_replies').select('post_id').in('post_id', postIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const replyCountMap = new Map<string, number>();
    for (const r of replyRows ?? []) {
      replyCountMap.set(r.post_id, (replyCountMap.get(r.post_id) ?? 0) + 1);
    }

    setPosts(postRows.map((p) => ({
      ...p,
      author: profileMap.get(p.author_id) ?? null,
      replyCount: replyCountMap.get(p.id) ?? 0,
    })));
    setLoading(false);
  }

  async function handlePost() {
    const trimmed = text.trim();
    if (!trimmed || !myId) return;
    setPosting(true);

    const { error } = await supabase.from('world_chat_posts').insert({
      author_id: myId,
      content: trimmed,
    });

    setPosting(false);

    if (error) {
      const friendly = error.message.includes('row-level security')
        ? await getWorldChatRetryMessage('world_chat_posts', myId)
        : error.message;
      Alert.alert('Could not post', friendly);
      return;
    }

    setText('');
    loadPosts();
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
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
            <Text style={styles.headerTitle}>World Chat</Text>
          </View>
          <View style={{ width: 36 }} />
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
                <Ionicons name="globe-outline" size={32} color={colors.textDisabled} />
                <Text style={styles.emptyText}>No posts yet. Be the first to say something!</Text>
              </View>
            }
            renderItem={({ item }) => {
              const canDelete = item.author_id === myId || isAdmin;
              return (
                <TouchableOpacity
                  style={styles.postCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/world-chat-thread?id=${item.id}`)}
                >
                  <View style={styles.postHeader}>
                    <TouchableOpacity
                      style={styles.postAuthorRow}
                      onPress={(e) => { e.stopPropagation(); router.push(`/user-profile?id=${item.author_id}`); }}
                    >
                      <Avatar avatarId={item.author?.avatar_id} avatarUrl={item.author?.avatar_url} username={item.author?.display_name} size={36} />
                      <View>
                        <View style={styles.postAuthorNameRow}>
                          <Text style={styles.postAuthorName}>{item.author?.display_name ?? 'Unknown'}</Text>
                          {item.author?.is_verified && <VerifiedBadge size={12} />}
                        </View>
                        <Text style={styles.postTime}>{formatRelativeTime(item.created_at)}</Text>
                      </View>
                    </TouchableOpacity>
                    {canDelete && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={(e) => { e.stopPropagation(); confirmDelete(item.id); }}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.postContent}>{item.content}</Text>

                  <View style={styles.postFooter}>
                    <Ionicons name="chatbubble-outline" size={14} color={colors.textFaint} />
                    <Text style={styles.postFooterText}>
                      {item.replyCount > 0 ? `${item.replyCount} repl${item.replyCount === 1 ? 'y' : 'ies'}` : 'Reply'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder="Say something to everyone..."
            placeholderTextColor={colors.textDisabled}
            value={text}
            onChangeText={(t) => setText(t.slice(0, MAX_LENGTH))}
            multiline
          />
          <View style={styles.composerFooter}>
            <Text style={[styles.charCount, remaining < 30 && styles.charCountLow]}>{remaining}</Text>
            <TouchableOpacity
              style={styles.postBtn}
              onPress={handlePost}
              disabled={posting || !text.trim()}
            >
              {posting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.postBtnText}>Post</Text>
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
    deleteBtn: { padding: 4 },
    postContent: { color: colors.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 10 },
    postFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    postFooterText: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
    composer: {
      borderTopWidth: 1, borderTopColor: colors.borderMuted,
      padding: 12, paddingBottom: 20, backgroundColor: colors.surface,
    },
    composerInput: {
      backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
      borderWidth: 1, borderColor: colors.border, maxHeight: 90, minHeight: 44,
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
