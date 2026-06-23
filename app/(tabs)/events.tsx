import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const GAMES = ['All', 'Free Fire', 'BGMI', 'COD Mobile', 'Valorant'];

export default function EventsScreen() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedGame === 'All') {
      setFiltered(tournaments);
    } else {
      setFiltered(tournaments.filter(t =>
        t.game.toLowerCase().includes(selectedGame.toLowerCase())
      ));
    }
  }, [selectedGame, tournaments]);

  async function fetchTournaments() {
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setTournaments(data);
      setFiltered(data);
    }
    setLoading(false);
  }

  const getGameColor = (game: string) => {
    const g = game.toLowerCase();
    if (g.includes('free fire') || g.includes('freefire')) return '#FF6B35';
    if (g.includes('bgmi')) return '#FFB800';
    if (g.includes('cod')) return '#00D4AA';
    if (g.includes('valorant')) return '#FF4655';
    return '#7C3AED';
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tournaments</Text>
          <Text style={styles.headerSub}>{filtered.length} live & upcoming events</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Text style={styles.notifIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Game Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {GAMES.map((game) => (
          <TouchableOpacity
            key={game}
            style={[
              styles.filterChip,
              selectedGame === game && styles.filterChipActive
            ]}
            onPress={() => setSelectedGame(game)}
          >
            <Text style={[
              styles.filterChipText,
              selectedGame === game && styles.filterChipTextActive
            ]}>{game}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tournament List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tournaments found.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { borderLeftColor: getGameColor(item.game), borderLeftWidth: 4 }]}
            onPress={() => router.push(`/tournament-details?id=${item.id}`)}
          >
            <View style={styles.cardTop}>
              <View style={[styles.gameTag, { backgroundColor: getGameColor(item.game) + '22' }]}>
                <Text style={[styles.gameTagText, { color: getGameColor(item.game) }]}>
                  {item.game.toUpperCase()}
                </Text>
              </View>
              <View style={[
                styles.statusBadge,
                item.status === 'upcoming' ? styles.statusUpcoming : styles.statusLive
              ]}>
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>

            <View style={styles.cardStats}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>₹{item.prize_pool}</Text>
                <Text style={styles.statLabel}>PRIZE</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>₹{item.entry_fee}</Text>
                <Text style={styles.statLabel}>ENTRY</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{item.max_teams}</Text>
                <Text style={styles.statLabel}>SLOTS</Text>
              </View>
            </View>
          </TouchableOpacity>
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
    alignItems: 'center', padding: 24, paddingTop: 60, paddingBottom: 16,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#aaa', marginTop: 2 },
  notifBtn: { padding: 8 },
  notifIcon: { fontSize: 22 },
  filterScroll: { maxHeight: 50 },
  filterContainer: { paddingHorizontal: 24, gap: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#1a1a1a',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  filterChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  filterChipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  listContent: { padding: 24, paddingTop: 16 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  gameTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  gameTagText: { fontSize: 11, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusUpcoming: { backgroundColor: '#1a1a3a' },
  statusLive: { backgroundColor: '#1a3a1a' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 14 },
  cardStats: { flexDirection: 'row', gap: 16 },
  stat: {},
  statValue: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
  statLabel: { fontSize: 10, color: '#555', fontWeight: '600', marginTop: 2 },
});