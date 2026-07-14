import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Modal
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import VerifiedBadge from '@/components/VerifiedBadge';
import NotificationBell from '@/components/NotificationBell';
import LeaderboardIcon from '@/components/LeaderboardIcon';

const GAMES: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'All', icon: 'apps' },
  { label: 'Free Fire', icon: 'flame' },
  { label: 'BGMI', icon: 'skull' },
  { label: 'COD Mobile', icon: 'skull' },
  { label: 'Valorant', icon: 'flash' },
];

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
  const [eventTab, setEventTab] = useState<'tournament' | 'scrim'>('tournament');
  const [lobbyFilter, setLobbyFilter] = useState<'all' | 'mini' | 'mega'>('all');

  useFocusEffect(
    useCallback(() => {
      fetchTournaments();
    }, [])
  );

  useEffect(() => {
    let results = tournaments.filter(t => (t.category ?? 'tournament') === eventTab);
    if (eventTab === 'scrim' && lobbyFilter !== 'all') {
      results = results.filter(t => t.lobby_type === lobbyFilter);
    }
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
  }, [selectedGame, search, tournaments, sortOption, eventTab, lobbyFilter]);

  async function fetchTournaments() {
    const { data } = await supabase
      .from('tournaments')
      .select('*, host:public_profiles!host_id(display_name, is_verified)')
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

  const getGameIcon = (game: string): keyof typeof Ionicons.glyphMap => {
    const g = game.toLowerCase();
    if (g.includes('free fire') || g.includes('freefire')) return 'flame';
    if (g.includes('bgmi') || g.includes('cod')) return 'skull';
    if (g.includes('valorant')) return 'flash';
    return 'game-controller';
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
        <View style={styles.headerLeft}>
          <View style={styles.headerIconBadge}>
            <Ionicons name="trophy" size={20} color="#FFB800" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Tournaments</Text>
            <Text style={styles.headerSub}>{filtered.length} events found</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => router.push('/leaderboard')}>
            <LeaderboardIcon size={36} />
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Tournaments / Scrims tabs */}
      <View style={styles.eventTabRow}>
        <TouchableOpacity style={styles.eventTabBtnWrap} onPress={() => setEventTab('tournament')} activeOpacity={0.85}>
          {eventTab === 'tournament' ? (
            <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.eventTabBtnInner}>
              <Text style={styles.eventTabTextActive}>Tournaments</Text>
            </LinearGradient>
          ) : (
            <View style={styles.eventTabBtnInner}>
              <Text style={styles.eventTabText}>Tournaments</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.eventTabBtnWrap} onPress={() => setEventTab('scrim')} activeOpacity={0.85}>
          {eventTab === 'scrim' ? (
            <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.eventTabBtnInner}>
              <Text style={styles.eventTabTextActive}>Scrims</Text>
            </LinearGradient>
          ) : (
            <View style={styles.eventTabBtnInner}>
              <Text style={styles.eventTabText}>Scrims</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {eventTab === 'scrim' && (
        <View style={styles.lobbyFilterRow}>
          {(['all', 'mini', 'mega'] as const).map((lobby) => (
            <TouchableOpacity
              key={lobby}
              style={[styles.lobbyChip, lobbyFilter === lobby && styles.lobbyChipActive]}
              onPress={() => setLobbyFilter(lobby)}
            >
              <Text style={[styles.lobbyChipText, lobbyFilter === lobby && styles.lobbyChipTextActive]}>
                {lobby === 'all' ? 'All Lobbies' : lobby === 'mini' ? 'Mini Lobby' : 'Mega Lobby'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search Bar + Sort Button */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tournaments..."
            placeholderTextColor="#444"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#555" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.sortBtn, isSortActive && styles.sortBtnActive]}
          onPress={() => setSortModalVisible(true)}
        >
          <Ionicons name="swap-vertical" size={15} color={isSortActive ? '#7C3AED' : '#aaa'} />
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
              key={game.label}
              style={[styles.filterChip, selectedGame === game.label && styles.filterChipActive]}
              onPress={() => setSelectedGame(game.label)}
            >
              <Ionicons
                name={game.icon}
                size={13}
                color={selectedGame === game.label ? '#fff' : '#888'}
              />
              <Text style={[styles.filterChipText, selectedGame === game.label && styles.filterChipTextActive]}>
                {game.label}
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
            <View style={styles.emptyIconCircle}>
              <Ionicons name="search" size={28} color="#444" />
            </View>
            <Text style={styles.emptyText}>No tournaments found.</Text>
            <Text style={styles.emptySubText}>Try a different search or game filter.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const gameColor = getGameColor(item.game);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/tournament-details?id=${item.id}`)}
              activeOpacity={0.85}
            >
              <View style={styles.cardHero}>
                {item.banner_url ? (
                  <Image source={{ uri: item.banner_url }} style={styles.cardBanner} contentFit="cover" />
                ) : (
                  <LinearGradient
                    colors={[gameColor + '4d', '#0a0a0a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardBannerFallback}
                  >
                    <Ionicons name={getGameIcon(item.game)} size={72} color={gameColor + '40'} />
                  </LinearGradient>
                )}
                <View style={styles.cardHeroOverlay}>
                  <View style={[styles.gameTag, { backgroundColor: gameColor }]}>
                    <Text style={styles.gameTagText}>{item.game.toUpperCase()}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
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

                <View style={styles.hostRow}>
                  <Text style={styles.hostName}>by {item.host?.display_name}</Text>
                  {item.host?.is_verified && <VerifiedBadge size={13} />}
                </View>

                <View style={styles.cardDateRow}>
                  <Ionicons name="calendar-outline" size={12} color="#666" />
                  <Text style={styles.cardDate}>{formatDate(item.start_time)}</Text>
                </View>

                <View style={styles.cardStats}>
                  <View style={[styles.statChip, { backgroundColor: '#FFB80014' }]}>
                    <Ionicons name="cash" size={14} color="#FFB800" />
                    <View>
                      <Text style={[styles.statChipValue, { color: '#FFB800' }]}>₹{item.prize_pool}</Text>
                      <Text style={styles.statChipLabel}>PRIZE</Text>
                    </View>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: '#00D4AA14' }]}>
                    <Ionicons name="ticket" size={14} color="#00D4AA" />
                    <View>
                      <Text style={[styles.statChipValue, { color: '#00D4AA' }]}>₹{item.entry_fee}</Text>
                      <Text style={styles.statChipLabel}>ENTRY</Text>
                    </View>
                  </View>
                  <View style={[styles.statChip, { backgroundColor: '#7C3AED14' }]}>
                    <Ionicons name="people" size={14} color="#7C3AED" />
                    <View>
                      <Text style={[styles.statChipValue, { color: '#7C3AED' }]}>{item.max_teams}</Text>
                      <Text style={styles.statChipLabel}>SLOTS</Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#FFB80018', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventTabRow: {
    flexDirection: 'row', marginHorizontal: 24, marginBottom: 12,
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: '#2a2a2a', gap: 4,
  },
  eventTabBtnWrap: { flex: 1 },
  eventTabBtnInner: { paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  eventTabText: { color: '#aaa', fontSize: 14, fontWeight: '700' },
  eventTabTextActive: { color: '#fff', fontSize: 14, fontWeight: '700' },
  lobbyFilterRow: {
    flexDirection: 'row', gap: 8, marginHorizontal: 24, marginBottom: 14,
  },
  lobbyChip: {
    flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center',
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  lobbyChipActive: { backgroundColor: '#FFB80022', borderColor: '#FFB800' },
  lobbyChipText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  lobbyChipTextActive: { color: '#FFB800', fontWeight: '700' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 24, marginBottom: 14, gap: 10,
  },
  searchContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 46, borderRadius: 12,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  sortBtnActive: { backgroundColor: '#7C3AED22', borderColor: '#7C3AED' },
  sortBtnText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  sortBtnTextActive: { color: '#7C3AED', fontWeight: '700' },
  filterWrapper: { marginBottom: 4 },
  filterContainer: { paddingHorizontal: 24, gap: 8, paddingVertical: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, backgroundColor: '#1a1a1a',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  filterChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  filterChipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  listContent: { padding: 24, paddingTop: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  emptyText: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptySubText: { color: '#555', fontSize: 13 },
  card: {
    backgroundColor: '#161616', borderRadius: 18,
    marginBottom: 16, borderWidth: 1, borderColor: '#262626', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  cardHero: { height: 130, position: 'relative' },
  cardBanner: { width: '100%', height: '100%' },
  cardBannerFallback: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  cardHeroOverlay: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  cardBody: { padding: 16 },
  gameTag: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 3,
  },
  gameTagText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 4,
  },
  statusUpcoming: { backgroundColor: '#0d2e2ae6' },
  statusLive: { backgroundColor: '#3a2a00e6' },
  statusCompleted: { backgroundColor: '#3a1414e6' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFB800' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  cardTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginBottom: 8,
  },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff' },
  hostRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  hostName: { fontSize: 12, color: '#888', fontWeight: '600' },
  cardDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  cardDate: { fontSize: 12, color: '#666', fontWeight: '600' },
  cardStats: { flexDirection: 'row', gap: 8 },
  statChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
  },
  statChipValue: { fontSize: 13, fontWeight: '800' },
  statChipLabel: { fontSize: 9, color: '#666', fontWeight: '700', marginTop: 1 },
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
