import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import VerifiedBadge from '@/components/VerifiedBadge';

export default function Leaderboard() {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.rpc('get_leaderboard');
    if (error) console.log('Leaderboard error:', error.message);
    if (data) setData(data);
    setLoading(false);
  }

  function medal(rank: number) {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return `#${rank + 1}`;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏆 Leaderboard</Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.player_id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No results recorded yet.</Text>
        }
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Text style={styles.rank}>{medal(index)}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.usernameRow}>
                <Text style={styles.username}>{item.username}</Text>
                {item.is_verified && <VerifiedBadge size={13} />}
              </View>
              <Text style={styles.subStat}>{item.matches_played} matches played</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{item.wins}</Text>
              <Text style={styles.statLabel}>WINS</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{item.total_kills}</Text>
              <Text style={styles.statLabel}>KILLS</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 24,
    paddingTop: 60, paddingBottom: 16,
  },
  backText: { color: '#7C3AED', fontSize: 15, fontWeight: '600', width: 60 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  listContent: { padding: 24, paddingTop: 8 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 60 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2a2a2a',
  },
  rank: { width: 36, fontSize: 16, fontWeight: '800', color: '#fff', textAlign: 'center' },
  usernameRow: { flexDirection: 'row', alignItems: 'center' },
  username: { color: '#fff', fontSize: 15, fontWeight: '700' },
  subStat: { color: '#555', fontSize: 11, marginTop: 2 },
  statCol: { alignItems: 'center', marginLeft: 16, minWidth: 44 },
  statValue: { color: '#7C3AED', fontSize: 16, fontWeight: '800' },
  statLabel: { color: '#555', fontSize: 9, fontWeight: '700', marginTop: 2 },
});