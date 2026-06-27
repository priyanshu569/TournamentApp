import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, ScrollView, TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import VerifiedBadge from '@/components/VerifiedBadge';
import NotificationBell from '@/components/NotificationBell';

const GAMES = ['All', 'Free Fire', 'BGMI', 'COD Mobile', 'Valorant'];

export default function EventsScreen() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTournaments(); }, []);

  useEffect(() => {
    let results = tournaments;
    if (selectedGame !== 'All') {
      results = results.filter(t =>
        t.game.toLowerCase().includes(selectedGame.toLowerCase())
      );
    }
    if (search.trim()) {
      results = results.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.game.toLowerCase().includes(search.toLowerCase())
      );
    }
    setFiltered(results);
  }, [selectedGame, search, tournaments]);

  async function fetchTournaments() {
    const { data } = await supabase
      .from('tournaments')
      .select('*, host:public_profiles!host_id(username, is_verified)')
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
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
          <Text style={styles.headerSub}>{filtered.length} events found</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.leaderboardBtn} onPress={() => router.push('/leaderboard')}>
            <Text style={styles.leaderboardIcon}>🏆</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search tournaments..."
          placeholderTextColor="#444"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Game Filter */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {GAMES.map((game) => (
            <TouchableOpacity
              key={game}
              style={[styles.filterChip, selectedGame === game && styles.filterChipActive]}
              onPress={() => setSelectedGame(game)}
            >
              <Text style={[styles.filterChipText, selectedGame === game && styles.filterChipTextActive]}>
                {game}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tournament List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>No tournaments found.</Text>
            <Text style={styles.emptySubText}>Try a different search or game filter.</Text>
          </View>
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
                item.status === 'ongoing' ? styles.statusLive : styles.statusUpcoming
              ]}>
                {item.status === 'ongoing' && <View style={styles.liveDot} />}
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>

            <View style={styles.hostRow}>
              <Text style={styles.hostName}>by {item.host?.username}</Text>
              {item.host?.is_verified && <VerifiedBadge size={13} />}
            </View>

            <Text style={styles.cardDate}>🗓 {formatDate(item.start_time)}</Text>

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
    alignItems: 'center', padding: 24, paddingTop: 60, paddingBottom: 12,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#aaa', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leaderboardBtn: { padding: 8 },
  leaderboardIcon: { fontSize: 20 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', marginHorizontal: 24,
    borderRadius: 12, paddingHorizontal: 14,
    marginBottom: 14, borderWidth: 1, borderColor: '#2a2a2a',
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
  clearBtn: { color: '#555', fontSize: 16, padding: 4 },
  filterWrapper: { marginBottom: 8 },
  filterContainer: { paddingHorizontal: 24, gap: 8, paddingVertical: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, backgroundColor: '#1a1a1a',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  filterChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  filterChipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  listContent: { padding: 24, paddingTop: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptySubText: { color: '#555', fontSize: 13 },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  gameTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  gameTagText: { fontSize: 11, fontWeight: '800' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, gap: 4,
  },
  statusUpcoming: { backgroundColor: '#1a1a3a' },
  statusLive: { backgroundColor: '#1a3a1a' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D4AA' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  hostRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  hostName: { fontSize: 12, color: '#888', fontWeight: '600' },
  cardDate: { fontSize: 12, color: '#555', marginBottom: 12 },
  cardStats: { flexDirection: 'row', gap: 16 },
  stat: {},
  statValue: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
  statLabel: { fontSize: 10, color: '#555', fontWeight: '600', marginTop: 2 },
});