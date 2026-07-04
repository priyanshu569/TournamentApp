import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import VerifiedBadge from '@/components/VerifiedBadge';
import NotificationBell from '@/components/NotificationBell';

const GAMES = ['All', 'Free Fire', 'BGMI', 'COD Mobile', 'Valorant'];

type SortOption =
  | 'newest'
  | 'prize_high'
  | 'prize_low'
  | 'entry_high'
  | 'entry_low'
  | 'date_soonest'
  | 'date_latest'
  | 'slots_high'
  | 'slots_low';

const SORT_OPTIONS: { value: SortOption; label: string; shortLabel: string; icon: string }[] = [
  { value: 'newest', label: 'Newest First', shortLabel: 'Newest', icon: '🆕' },
  { value: 'prize_high', label: 'Prize Pool: High to Low', shortLabel: 'Prize ↓', icon: '🏆' },
  { value: 'prize_low', label: 'Prize Pool: Low to High', shortLabel: 'Prize ↑', icon: '🏆' },
  { value: 'entry_low', label: 'Entry Fee: Low to High', shortLabel: 'Entry ↑', icon: '💰' },
  { value: 'entry_high', label: 'Entry Fee: High to Low', shortLabel: 'Entry ↓', icon: '💰' },
  { value: 'date_soonest', label: 'Start Date: Soonest First', shortLabel: 'Soonest', icon: '🗓' },
  { value: 'date_latest', label: 'Start Date: Latest First', shortLabel: 'Latest', icon: '🗓' },
  { value: 'slots_low', label: 'Slots Left: Fewest First', shortLabel: 'Filling Up', icon: '🔥' },
  { value: 'slots_high', label: 'Slots Left: Most First', shortLabel: 'Most Slots', icon: '🔥' },
];

export default function EventsScreen() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [sortModalVisible, setSortModalVisible] = useState(false);

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

    results = [...results].sort((a, b) => {
      switch (sortOption) {
        case 'prize_high':
          return (b.prize_pool ?? 0) - (a.prize_pool ?? 0);
        case 'prize_low':
          return (a.prize_pool ?? 0) - (b.prize_pool ?? 0);
        case 'entry_high':
          return (b.entry_fee ?? 0) - (a.entry_fee ?? 0);
        case 'entry_low':
          return (a.entry_fee ?? 0) - (b.entry_fee ?? 0);
        case 'date_soonest':
          return new Date(a.start_time ?? 0).getTime() - new Date(b.start_time ?? 0).getTime();
        case 'date_latest':
          return new Date(b.start_time ?? 0).getTime() - new Date(a.start_time ?? 0).getTime();
        case 'slots_low':
          return (a.max_teams ?? 0) - (b.max_teams ?? 0);
        case 'slots_high':
          return (b.max_teams ?? 0) - (a.max_teams ?? 0);
        case 'newest':
        default:
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      }
    });

    setFiltered(results);
  }, [selectedGame, search, tournaments, sortOption]);

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

  const activeSortOption = SORT_OPTIONS.find(o => o.value === sortOption);
  const isSortActive = sortOption !== 'newest';

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

      {/* Search Bar + Sort Button */}
      <View style={styles.searchRow}>
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

        <TouchableOpacity
          style={[styles.sortBtn, isSortActive && styles.sortBtnActive]}
          onPress={() => setSortModalVisible(true)}
        >
          <Text style={styles.sortBtnIcon}>⇅</Text>
          <Text style={[styles.sortBtnText, isSortActive && styles.sortBtnTextActive]}>
            {isSortActive ? activeSortOption?.shortLabel : 'Sort'}
          </Text>
        </TouchableOpacity>
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
                item.status === 'ongoing' ? styles.statusLive :
                  item.status === 'completed' ? styles.statusCompleted :
                    styles.statusUpcoming
              ]}>
                {(item.status === 'ongoing' || item.status === 'upcoming') && <View style={[styles.liveDot, {
                  backgroundColor: item.status === 'upcoming' ? '#00D4AA' : '#FFB800'
                }]} />}
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

      {/* Sort Modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={styles.sortSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Sort By</Text>
              {isSortActive && (
                <TouchableOpacity onPress={() => { setSortOption('newest'); setSortModalVisible(false); }}>
                  <Text style={styles.sheetReset}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.sortOptionRow,
                    sortOption === opt.value && styles.sortOptionRowActive
                  ]}
                  onPress={() => {
                    setSortOption(opt.value);
                    setSortModalVisible(false);
                  }}
                >
                  <Text style={styles.sortOptionIcon}>{opt.icon}</Text>
                  <Text style={[
                    styles.sortOptionText,
                    sortOption === opt.value && styles.sortOptionTextActive
                  ]}>
                    {opt.label}
                  </Text>
                  {sortOption === opt.value && (
                    <Text style={styles.sortOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 24, marginBottom: 14, gap: 10,
  },
  searchContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
  clearBtn: { color: '#555', fontSize: 16, padding: 4 },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 46, borderRadius: 12,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  sortBtnActive: { backgroundColor: '#7C3AED22', borderColor: '#7C3AED' },
  sortBtnIcon: { fontSize: 14, color: '#aaa' },
  sortBtnText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  sortBtnTextActive: { color: '#7C3AED', fontWeight: '700' },
  filterWrapper: { marginBottom: 4 },
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
  statusUpcoming: { backgroundColor: '#0a2a2a' },
  statusLive: { backgroundColor: '#FFB80022' },
  statusCompleted: { backgroundColor: '#FF444422' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFB800' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  hostRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  hostName: { fontSize: 12, color: '#888', fontWeight: '600' },
  cardDate: { fontSize: 12, color: '#555', marginBottom: 12 },
  cardStats: { flexDirection: 'row', gap: 16 },
  stat: {},
  statValue: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
  statLabel: { fontSize: 10, color: '#555', fontWeight: '600', marginTop: 2 },
  modalOverlay: {
    flex: 1, backgroundColor: '#000000aa',
    justifyContent: 'flex-end',
  },
  sortSheet: {
    backgroundColor: '#141414', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34,
    maxHeight: '70%', borderWidth: 1, borderColor: '#2a2a2a', borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#333',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  sheetReset: { color: '#7C3AED', fontSize: 13, fontWeight: '700' },
  sortOptionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 4,
  },
  sortOptionRowActive: { backgroundColor: '#7C3AED18' },
  sortOptionIcon: { fontSize: 16, marginRight: 12, width: 20 },
  sortOptionText: { flex: 1, color: '#ccc', fontSize: 14, fontWeight: '600' },
  sortOptionTextActive: { color: '#fff', fontWeight: '700' },
  sortOptionCheck: { color: '#7C3AED', fontSize: 16, fontWeight: '800' },
});