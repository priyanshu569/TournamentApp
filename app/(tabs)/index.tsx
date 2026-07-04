import { supabase } from '@/lib/supabase';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, ScrollView, StyleSheet,
  Text, TouchableOpacity, View
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import VerifiedBadge from '@/components/VerifiedBadge';
import NotificationBell from '@/components/NotificationBell';
import FragifyLogo from '@/components/FragifyLogo';

const GAMES = ['All', 'Free Fire', 'BGMI', 'COD Mobile', 'Valorant'];

export default function HomeScreen() {
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState('All');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useState(() => {
    if (selectedGame === 'All') {
      setFiltered(tournaments);
    } else {
      setFiltered(tournaments.filter(t =>
        t.game.toLowerCase().includes(selectedGame.toLowerCase())
      ));
    }
  });

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from('Profiles')
      .select('role, username')
      .eq('id', userData.user.id)
      .single();

    if (profile) {
      setRole(profile.role);
      setUsername(profile.username || '');
    }

    const isHost = profile?.role === 'host';
    const query = supabase
      .from('tournaments')
      .select('*, host:public_profiles!host_id(username, is_verified)')
      .order('created_at', { ascending: false });

    if (isHost) query.eq('host_id', userData.user.id);

    const { data: tournamentData } = await query;
    if (tournamentData) {
      setTournaments(tournamentData);
      setFiltered(
        selectedGame === 'All'
          ? tournamentData
          : tournamentData.filter((t: any) =>
              t.game.toLowerCase().includes(selectedGame.toLowerCase())
            )
      );
    }

    setLoading(false);
  }

  function handleGameSelect(game: string) {
    setSelectedGame(game);
    if (game === 'All') {
      setFiltered(tournaments);
    } else {
      setFiltered(tournaments.filter(t =>
        t.game.toLowerCase().includes(game.toLowerCase())
      ));
    }
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
        <View style={styles.headerLeft}>
          <FragifyLogo size={40} />
          <View>
            <Text style={styles.appName}>FRAGIFY</Text>
            <Text style={styles.appTagline}>ESPORTS · COMPETE · WIN</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.leaderboardBtn} onPress={() => router.push('/leaderboard')}>
            <Text style={styles.leaderboardIcon}>🏆</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Welcome */}
      <View style={styles.welcomeBox}>
        <Text style={styles.welcomeText}>
          {role === 'host' ? `Welcome back, ${username} 🏆` : `Hey ${username} 🎮`}
        </Text>
        <Text style={styles.welcomeSub}>
          {role === 'host' ? 'Manage your tournaments' : 'Find your next tournament'}
        </Text>
      </View>

      {/* Host Create Button */}
      {role === 'host' && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/create-tournament')}
        >
          <Text style={styles.createButtonText}>+ Create Tournament</Text>
        </TouchableOpacity>
      )}

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
              onPress={() => handleGameSelect(game)}
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
          <Text style={styles.emptyText}>
            {role === 'host' ? 'No tournaments yet. Create one!' : 'No tournaments available.'}
          </Text>
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
              <View style={[styles.statusBadge, {
                backgroundColor: item.status === 'upcoming' ? '#00D4AA22' :
                  item.status === 'ongoing' ? '#FFB80022' : '#FF444422'
              }]}>
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>

            <View style={styles.hostRow}>
              <Text style={styles.hostName}>by {item.host?.username}</Text>
              {item.host?.is_verified && <VerifiedBadge size={13} />}
            </View>

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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logo: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#7C3AED', justifyContent: 'center', alignItems: 'center',
  },
  logoText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  appName: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  appTagline: { color: '#555', fontSize: 9, letterSpacing: 1.5, marginTop: 1 },
  leaderboardBtn: { padding: 8 },
  leaderboardIcon: { fontSize: 20 },
  welcomeBox: { paddingHorizontal: 24, marginBottom: 16 },
  welcomeText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  welcomeSub: { color: '#aaa', fontSize: 13, marginTop: 2 },
  createButton: {
    backgroundColor: '#7C3AED', marginHorizontal: 24,
    paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', marginBottom: 16,
  },
  createButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
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
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 14 },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  gameTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  gameTagText: { fontSize: 11, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  hostRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  hostName: { fontSize: 12, color: '#888', fontWeight: '600' },
  cardStats: { flexDirection: 'row', gap: 16 },
  stat: {},
  statValue: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
  statLabel: { fontSize: 10, color: '#555', fontWeight: '600', marginTop: 2 },
});