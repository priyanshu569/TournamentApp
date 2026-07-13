import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const FILTERS = ['pending', 'reviewed', 'dismissed'] as const;
type Filter = typeof FILTERS[number];

export default function AdminReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => { loadReports(); }, [filter]);

  async function loadReports() {
    setLoading(true);

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Failed to load reports:', error.message);
    } else if (data) {
      const reporterIds = [...new Set(data.map((r: any) => r.reporter_id))];
      const reportedIds = [...new Set(data.map((r: any) => r.reported_user_id).filter(Boolean))];
      const allIds = [...new Set([...reporterIds, ...reportedIds])];

      const { data: profiles } = allIds.length > 0
        ? await supabase.from('public_profiles').select('id, username, display_name').in('id', allIds)
        : { data: [] };

      const nameMap = new Map((profiles ?? []).map((p: any) => [
        p.id,
        p.username ? `${p.display_name ?? 'Unknown'} (@${p.username})` : (p.display_name ?? 'Unknown'),
      ]));

      setReports(data.map((r: any) => ({
        ...r,
        reporter_name: nameMap.get(r.reporter_id) ?? 'Unknown',
        reported_name: r.reported_user_id ? (nameMap.get(r.reported_user_id) ?? 'Unknown') : null,
      })));
    }

    setLoading(false);
  }

  async function handleReview(reportId: string, status: 'reviewed' | 'dismissed') {
    setActingId(reportId);

    const { error } = await supabase
      .from('reports')
      .update({ status })
      .eq('id', reportId);

    setActingId(null);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setReports((prev) => prev.filter((r) => r.id !== reportId));
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
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
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No {filter} reports.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.reportedName}>
                {item.reported_name ? `Reported: ${item.reported_name}` : 'Reported message'}
              </Text>
              <Text style={styles.reason}>{item.reason}</Text>
              <Text style={styles.reporter}>Reported by {item.reporter_name}</Text>
              <Text style={styles.date}>
                {new Date(item.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>

              {filter === 'pending' && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={() => handleReview(item.id, 'dismissed')}
                    disabled={actingId === item.id}
                  >
                    {actingId === item.id
                      ? <ActivityIndicator color="#aaa" size="small" />
                      : <Text style={styles.dismissBtnText}>Dismiss</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reviewedBtn}
                    onPress={() => handleReview(item.id, 'reviewed')}
                    disabled={actingId === item.id}
                  >
                    {actingId === item.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.reviewedBtnText}>Mark Reviewed</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 60 },
  headerRow: { paddingHorizontal: 24, marginBottom: 8 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
  },
  heading: { color: '#fff', fontSize: 24, fontWeight: '800', paddingHorizontal: 24, marginBottom: 4 },
  sub: { color: '#888', fontSize: 13, paddingHorizontal: 24, marginBottom: 20 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  filterChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  filterChipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  listContent: { padding: 24, paddingTop: 0 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#161616', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#262626',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  reportedName: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  reason: { color: '#ccc', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  reporter: { color: '#888', fontSize: 12, marginBottom: 2 },
  date: { color: '#555', fontSize: 11 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dismissBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  dismissBtnText: { color: '#aaa', fontSize: 13, fontWeight: '700' },
  reviewedBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#7C3AED',
  },
  reviewedBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
