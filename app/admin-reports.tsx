import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TextInput, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getSignedReportProofUrl } from '@/lib/reportProof';
import { getSignedChatImageUrl } from '@/lib/chatImage';
import { notifyAndLog } from '@/lib/notifications';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const FILTERS = ['pending', 'reviewed', 'dismissed'] as const;
type Filter = typeof FILTERS[number];

const DEFAULT_RESPONSE: Record<'reviewed' | 'dismissed', string> = {
  reviewed: 'Your report was reviewed and action was taken.',
  dismissed: 'Your report was reviewed — no action was needed.',
};

export default function AdminReportsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [reports, setReports] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<Record<string, string>>({});

  useEffect(() => { loadReports(); }, [filter]);

  async function onRefresh() {
    setRefreshing(true);
    await loadReports(true);
    setRefreshing(false);
  }

  async function loadReports(silent = false) {
    if (!silent) setLoading(true);

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Failed to load reports:', error.message);
      setLoading(false);
      return;
    }

    const rows = data ?? [];

    const postIds = [...new Set(rows.map((r: any) => r.reported_post_id).filter(Boolean))];
    const { data: posts } = postIds.length > 0
      ? await supabase.from('world_chat_posts').select('id, author_id, content, image_url').in('id', postIds)
      : { data: [] };
    const postMap = new Map((posts ?? []).map((p: any) => [p.id, p]));

    const messageDetails = new Map<string, any>();
    await Promise.all(
      rows.filter((r: any) => r.reported_message_id).map(async (r: any) => {
        const { data: msg } = await supabase.rpc('get_reported_message', { p_message_id: r.reported_message_id });
        if (msg?.[0]) messageDetails.set(r.reported_message_id, msg[0]);
      })
    );

    const proofUrlMap = new Map<string, string>();
    await Promise.all(
      rows.filter((r: any) => r.proof_image_url).map(async (r: any) => {
        try {
          proofUrlMap.set(r.id, await getSignedReportProofUrl(r.proof_image_url));
        } catch { /* ignore -- proof just won't render */ }
      })
    );

    const imageUrlMap = new Map<string, string>();
    await Promise.all(
      rows.filter((r: any) => {
        const msg = r.reported_message_id ? messageDetails.get(r.reported_message_id) : null;
        return msg?.image_url;
      }).map(async (r: any) => {
        const msg = messageDetails.get(r.reported_message_id);
        try {
          imageUrlMap.set(r.id, await getSignedChatImageUrl(msg.image_url));
        } catch { /* ignore */ }
      })
    );

    const reporterIds = [...new Set(rows.map((r: any) => r.reporter_id))];
    const reportedIds = [...new Set(rows.map((r: any) => r.reported_user_id).filter(Boolean))];
    const messageSenderIds = [...messageDetails.values()].map((m: any) => m.sender_id);
    const postAuthorIds = [...postMap.values()].map((p: any) => p.author_id);
    const allIds = [...new Set([...reporterIds, ...reportedIds, ...messageSenderIds, ...postAuthorIds])];

    const { data: profiles } = allIds.length > 0
      ? await supabase.from('public_profiles').select('id, username, display_name').in('id', allIds)
      : { data: [] };

    const nameMap = new Map((profiles ?? []).map((p: any) => [
      p.id,
      p.username ? `${p.display_name ?? 'Unknown'} (@${p.username})` : (p.display_name ?? 'Unknown'),
    ]));

    setReports(rows.map((r: any) => {
      const message = r.reported_message_id ? messageDetails.get(r.reported_message_id) : null;
      const post = r.reported_post_id ? postMap.get(r.reported_post_id) : null;
      const targetUserId = r.reported_user_id ?? message?.sender_id ?? post?.author_id ?? null;

      let targetType: 'Message' | 'World Chat Post' | 'Profile' = 'Profile';
      let preview: string | null = null;
      if (message) {
        targetType = 'Message';
        preview = message.image_url ? '📷 Photo message' : message.audio_url ? '🎤 Voice message' : message.content;
      } else if (post) {
        targetType = 'World Chat Post';
        preview = post.image_url && !post.content ? '📷 Photo post' : post.content;
      }

      return {
        ...r,
        reporter_name: nameMap.get(r.reporter_id) ?? 'Unknown',
        target_name: targetUserId ? (nameMap.get(targetUserId) ?? 'Unknown') : null,
        target_type: targetType,
        preview,
        preview_image: imageUrlMap.get(r.id) ?? post?.image_url ?? null,
        proof_url: proofUrlMap.get(r.id) ?? null,
      };
    }));

    setLoading(false);
  }

  async function handleReview(report: any, status: 'reviewed' | 'dismissed') {
    setActingId(report.id);

    const customResponse = (responseText[report.id] ?? '').trim();
    const finalResponse = customResponse || DEFAULT_RESPONSE[status];

    const { error } = await supabase
      .from('reports')
      .update({ status, admin_response: finalResponse })
      .eq('id', report.id);

    if (error) {
      setActingId(null);
      Alert.alert('Error', error.message);
      return;
    }

    const { data: reporterProfile } = await supabase
      .from('Profiles')
      .select('push_token, push_enabled')
      .eq('id', report.reporter_id)
      .single();

    await notifyAndLog(
      report.reporter_id,
      reporterProfile?.push_enabled ? reporterProfile?.push_token : null,
      'Report Update',
      finalResponse
    );

    setActingId(null);
    setReports((prev) => prev.filter((r) => r.id !== report.id));
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.heading}>⚠️ Reports</Text>
      <Text style={styles.sub}>Review reports of abuse or bad behavior.</Text>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.emptyText}>No {filter} reports.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.typeBadge}>
                <Ionicons
                  name={item.target_type === 'Message' ? 'chatbubble' : item.target_type === 'World Chat Post' ? 'globe' : 'person'}
                  size={11} color={colors.accent}
                />
                <Text style={styles.typeBadgeText}>{item.target_type}</Text>
              </View>

              <Text style={styles.reportedName}>
                {item.target_name ? `Reported: ${item.target_name}` : 'Reported content'}
              </Text>

              {!!item.preview && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewText} numberOfLines={4}>&ldquo;{item.preview}&rdquo;</Text>
                </View>
              )}
              {!!item.preview_image && (
                <Image source={{ uri: item.preview_image }} style={styles.previewImage} resizeMode="cover" />
              )}

              <Text style={styles.reason}>{item.reason}</Text>
              <Text style={styles.reporter}>Reported by {item.reporter_name}</Text>
              <Text style={styles.date}>
                {new Date(item.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>

              {item.proof_url && (
                <View style={styles.proofSection}>
                  <Text style={styles.proofLabel}>PROOF SUBMITTED</Text>
                  <Image source={{ uri: item.proof_url }} style={styles.previewImage} resizeMode="cover" />
                </View>
              )}

              {filter === 'pending' && (
                <>
                  <TextInput
                    style={styles.responseInput}
                    placeholder="Response to reporter (optional)..."
                    placeholderTextColor={colors.textDisabled}
                    value={responseText[item.id] ?? ''}
                    onChangeText={(t) => setResponseText((prev) => ({ ...prev, [item.id]: t }))}
                    multiline
                  />
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.dismissBtn}
                      onPress={() => handleReview(item, 'dismissed')}
                      disabled={actingId === item.id}
                    >
                      {actingId === item.id
                        ? <ActivityIndicator color={colors.textSecondary} size="small" />
                        : <Text style={styles.dismissBtnText}>Dismiss</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reviewedBtn}
                      onPress={() => handleReview(item, 'reviewed')}
                      disabled={actingId === item.id}
                    >
                      {actingId === item.id
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.reviewedBtnText}>Mark Reviewed</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {item.admin_response && filter !== 'pending' && (
                <View style={styles.responseShownBox}>
                  <Text style={styles.responseShownLabel}>Response sent:</Text>
                  <Text style={styles.responseShownText}>{item.admin_response}</Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
    headerRow: { paddingHorizontal: 24, marginBottom: 8 },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    heading: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', paddingHorizontal: 24, marginBottom: 4 },
    sub: { color: colors.textTertiary, fontSize: 13, paddingHorizontal: 24, marginBottom: 20 },
    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 16 },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    filterChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    filterChipTextActive: { color: '#fff' },
    listContent: { padding: 24, paddingTop: 0 },
    emptyText: { color: colors.textFaint, textAlign: 'center', marginTop: 40 },
    card: {
      backgroundColor: colors.surface, borderRadius: 14, padding: 16,
      marginBottom: 12, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    typeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
      backgroundColor: colors.accentMuted, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
      marginBottom: 8,
    },
    typeBadgeText: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
    reportedName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 6 },
    previewBox: {
      backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 10, marginBottom: 8,
      borderLeftWidth: 3, borderLeftColor: colors.border,
    },
    previewText: { color: colors.textSecondary, fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
    previewImage: { width: '100%', height: 160, borderRadius: 10, marginBottom: 8, backgroundColor: colors.surfaceAlt },
    reason: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 8 },
    reporter: { color: colors.textTertiary, fontSize: 12, marginBottom: 2 },
    date: { color: colors.textFaint, fontSize: 11 },
    proofSection: { marginTop: 12 },
    proofLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
    responseInput: {
      backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginTop: 12,
      borderWidth: 1, borderColor: colors.border, minHeight: 44, textAlignVertical: 'top',
    },
    actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    dismissBtn: {
      flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    dismissBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    reviewedBtn: {
      flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
      backgroundColor: colors.accent,
    },
    reviewedBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    responseShownBox: {
      marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: colors.surfaceAlt,
    },
    responseShownLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 },
    responseShownText: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  });
}
