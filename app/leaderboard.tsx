import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import VerifiedBadge from '@/components/VerifiedBadge';

const RANK_STYLES: { colors: [string, string]; icon: string; textColor: string }[] = [
  { colors: ['#FFD700', '#B8860B'], icon: '🥇', textColor: '#3a2a00' },
  { colors: ['#E0E0E0', '#9a9a9a'], icon: '🥈', textColor: '#2a2a2a' },
  { colors: ['#E8A56C', '#9a5a2a'], icon: '🥉', textColor: '#2a1a0a' },
];

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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIconBadge}>
            <Ionicons name="trophy" size={18} color="#FFB800" />
          </View>
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.player_uid}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="trophy-outline" size={28} color="#444" />
            </View>
            <Text style={styles.emptyText}>No results recorded yet.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const podium = RANK_STYLES[index];
          if (podium) {
            return (
              <LinearGradient
                colors={podium.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.podiumRow}
              >
                <Text style={styles.podiumMedal}>{podium.icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.usernameRow}>
                    <Text style={[styles.podiumUsername, { color: podium.textColor }]}>{item.username}</Text>
                    {item.is_verified && <VerifiedBadge size={13} />}
                  </View>
                  <Text style={[styles.podiumSubStat, { color: podium.textColor }]}>
                    {item.matches_played} matches played
                  </Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={[styles.podiumStatValue, { color: podium.textColor }]}>{item.wins}</Text>
                  <Text style={[styles.podiumStatLabel, { color: podium.textColor }]}>WINS</Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={[styles.podiumStatValue, { color: podium.textColor }]}>{item.total_kills}</Text>
                  <Text style={[styles.podiumStatLabel, { color: podium.textColor }]}>KILLS</Text>
                </View>
                <View style={styles.statCol}>
                  <Text style={[styles.podiumStatValue, { color: podium.textColor }]}>{item.total_points}</Text>
                  <Text style={[styles.podiumStatLabel, { color: podium.textColor }]}>PTS</Text>
                </View>
              </LinearGradient>
            );
          }

          return (
            <View style={styles.row}>
              <Text style={styles.rank}>#{index + 1}</Text>
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
              <View style={styles.statCol}>
                <Text style={[styles.statValue, styles.pointsValue]}>{item.total_points}</Text>
                <Text style={styles.statLabel}>PTS</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 60, paddingBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBadge: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#FFB80018', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  listContent: { padding: 24, paddingTop: 8 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  emptyText: { color: '#555', textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#161616', borderRadius: 14,
    padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#262626',
  },
  podiumRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  podiumMedal: { fontSize: 26, width: 40, textAlign: 'center' },
  podiumUsername: { fontSize: 16, fontWeight: '800' },
  podiumSubStat: { fontSize: 11, marginTop: 2, fontWeight: '600', opacity: 0.8 },
  podiumStatValue: { fontSize: 16, fontWeight: '900' },
  podiumStatLabel: { fontSize: 9, fontWeight: '800', marginTop: 2, opacity: 0.8 },
  rank: { width: 36, fontSize: 15, fontWeight: '800', color: '#666', textAlign: 'center' },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  username: { color: '#fff', fontSize: 15, fontWeight: '700' },
  subStat: { color: '#555', fontSize: 11, marginTop: 2 },
  statCol: { alignItems: 'center', marginLeft: 16, minWidth: 44 },
  statValue: { color: '#7C3AED', fontSize: 16, fontWeight: '800' },
  statLabel: { color: '#555', fontSize: 9, fontWeight: '700', marginTop: 2 },
  pointsValue: { color: '#FFB800' },
});
