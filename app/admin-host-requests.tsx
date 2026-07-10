import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { notifyAndLog } from '@/lib/notifications';

const FILTERS = ['pending', 'approved', 'rejected'] as const;
type Filter = typeof FILTERS[number];

export default function AdminHostRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => { loadRequests(); }, [filter]);

  async function loadRequests() {
    setLoading(true);
    const { data, error } = await supabase
      .from('host_requests')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Failed to load host requests:', error.message);
    } else {
      setRequests(data ?? []);
    }
    setLoading(false);
  }

  async function handleReview(request: any, approve: boolean) {
    setActingId(request.id);

    const { error } = await supabase.rpc('review_host_request', {
      p_request_id: request.id,
      p_approve: approve,
    });

    if (error) {
      setActingId(null);
      Alert.alert('Error', error.message);
      return;
    }

    try {
      await notifyAndLog(
        request.user_id,
        null,
        approve ? '🎉 Host Access Approved' : 'Host Request Update',
        approve
          ? "You're now approved to create tournaments on Fragify!"
          : 'Your host access request was not approved this time.'
      );
    } catch (err) {
      console.log('Notify requester error:', err);
    }

    setActingId(null);
    setRequests((prev) => prev.filter((r) => r.id !== request.id));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>🏆 Host Requests</Text>
      <Text style={styles.sub}>Review requests to create tournaments.</Text>

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
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No {filter} requests.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.contact}>📞 {item.contact}</Text>
              {item.details ? <Text style={styles.details}>{item.details}</Text> : null}
              <Text style={styles.date}>
                Requested {new Date(item.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>

              {filter === 'pending' && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleReview(item, false)}
                    disabled={actingId === item.id}
                  >
                    {actingId === item.id
                      ? <ActivityIndicator color="#ff4444" size="small" />
                      : <Text style={styles.rejectBtnText}>Reject</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleReview(item, true)}
                    disabled={actingId === item.id}
                  >
                    {actingId === item.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.approveBtnText}>Approve</Text>
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
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a',
  },
  name: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  contact: { color: '#aaa', fontSize: 13, marginBottom: 6 },
  details: { color: '#ccc', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  date: { color: '#555', fontSize: 11 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rejectBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#1a0a0a', borderWidth: 1, borderColor: '#3a1a1a',
  },
  rejectBtnText: { color: '#ff4444', fontSize: 13, fontWeight: '700' },
  approveBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#7C3AED',
  },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
