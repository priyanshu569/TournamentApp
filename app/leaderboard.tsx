import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  ActivityIndicator, TouchableOpacity, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import VerifiedBadge from '@/components/VerifiedBadge';
import Avatar from '@/components/Avatar';
import LeaderboardIcon from '@/components/LeaderboardIcon';

const RANK_STYLES: { colors: [string, string]; icon: string; textColor: string }[] = [
  { colors: ['#FFD700', '#B8860B'], icon: '🥇', textColor: '#3a2a00' },
  { colors: ['#E0E0E0', '#9a9a9a'], icon: '🥈', textColor: '#2a2a2a' },
  { colors: ['#E8A56C', '#9a5a2a'], icon: '🥉', textColor: '#2a1a0a' },
];

const GAMES: { label: string; value: string | null; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'All', value: null, icon: 'apps' },
  { label: 'Free Fire', value: 'Free Fire', icon: 'flame' },
  { label: 'BGMI', value: 'BGMI', icon: 'skull' },
  { label: 'COD Mobile', value: 'COD Mobile', icon: 'skull' },
  { label: 'Valorant', value: 'Valorant', icon: 'flash' },
];

export default function Leaderboard() {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [game, setGame] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(game); }, [game]);

  async function load(p_game: string | null) {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_leaderboard', { p_game });
    if (error) console.log('Leaderboard error:', error.message);
    if (data) setData(data);
    setLoading(false);
  }

  function goToProfile(item: any) {
    if (item.linked_profile_id) {
      router.push(`/user-profile?id=${item.linked_profile_id}`);
    }
  }

  function showScoringInfo() {
    Alert.alert(
      'How points work',
      'Total points = placement points (based on where your team finished each match) + your own kills × kill point value. Only your individual kills count toward your score, never your teammates’. Hosts can customize both curves per tournament.',
    );
  }

  function pointsSummary(item: any) {
    const matches = `${item.matches_played} match${item.matches_played === 1 ? '' : 'es'}`;
    return `${matches} · ${item.placement_points}+${item.kill_points} pts`;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <LeaderboardIcon size={32} />
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>
        <TouchableOpacity style={styles.infoBtn} onPress={showScoringInfo}>
          <Ionicons name="information-circle-outline" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <View style={styles.gameRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gameRow}>
          {GAMES.map((g) => (
            <TouchableOpacity
              key={g.label}
              style={[styles.gameChip, game === g.value && styles.gameChipActive]}
              onPress={() => setGame(g.value)}
            >
              <Ionicons name={g.icon} size={13} color={game === g.value ? '#fff' : '#888'} />
              <Text style={[styles.gameChipText, game === g.value && styles.gameChipTextActive]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <LinearGradient
          colors={['#0a0a0a00', '#0a0a0a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gameRowFade}
          pointerEvents="none"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.identity_key}
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
            const linked = !!item.linked_profile_id;

            if (podium) {
              return (
                <TouchableOpacity activeOpacity={linked ? 0.85 : 1} onPress={() => goToProfile(item)} disabled={!linked}>
                  <LinearGradient
                    colors={podium.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.podiumRow}
                  >
                    <Text style={styles.podiumMedal}>{podium.icon}</Text>
                    <View style={[styles.avatarWrap, !linked && styles.avatarWrapUnlinked]}>
                      <Avatar avatarId={item.avatar_id} username={item.username} size={34} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.usernameRow}>
                        <Text style={[styles.podiumUsername, { color: podium.textColor }]}>{item.username}</Text>
                        {item.is_verified && <VerifiedBadge size={13} />}
                      </View>
                      <Text style={[styles.podiumSubStat, { color: podium.textColor }]}>
                        {pointsSummary(item)}
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
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity style={styles.row} activeOpacity={linked ? 0.85 : 1} onPress={() => goToProfile(item)} disabled={!linked}>
                <Text style={styles.rank}>#{index + 1}</Text>
                <View style={[styles.avatarWrap, !linked && styles.avatarWrapUnlinked]}>
                  <Avatar avatarId={item.avatar_id} username={item.username} size={34} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.usernameRow}>
                    <Text style={styles.username}>{item.username}</Text>
                    {item.is_verified && <VerifiedBadge size={13} />}
                  </View>
                  <Text style={styles.subStat}>{pointsSummary(item)}</Text>
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
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 60, paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  infoBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  gameRowWrap: { position: 'relative' },
  gameRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  gameRowFade: {
    position: 'absolute', right: 0, top: 0, bottom: 12,
    width: 32,
  },
  gameChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  gameChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  gameChipText: { color: '#888', fontSize: 12, fontWeight: '600' },
  gameChipTextActive: { color: '#fff' },
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
  podiumMedal: { fontSize: 26, width: 32, textAlign: 'center' },
  avatarWrap: { marginRight: 12 },
  avatarWrapUnlinked: { opacity: 0.55 },
  podiumUsername: { fontSize: 16, fontWeight: '800' },
  podiumSubStat: { fontSize: 11, marginTop: 2, fontWeight: '600', opacity: 0.8 },
  podiumStatValue: { fontSize: 16, fontWeight: '900' },
  podiumStatLabel: { fontSize: 9, fontWeight: '800', marginTop: 2, opacity: 0.8 },
  rank: { width: 28, fontSize: 15, fontWeight: '800', color: '#666', textAlign: 'center' },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  username: { color: '#fff', fontSize: 15, fontWeight: '700' },
  subStat: { color: '#555', fontSize: 11, marginTop: 2 },
  statCol: { alignItems: 'center', marginLeft: 16, minWidth: 44 },
  statValue: { color: '#7C3AED', fontSize: 16, fontWeight: '800' },
  statLabel: { color: '#555', fontSize: 9, fontWeight: '700', marginTop: 2 },
  pointsValue: { color: '#FFB800' },
});
