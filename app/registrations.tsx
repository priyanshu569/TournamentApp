import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  FlatList, TouchableOpacity
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function Registrations() {
  const { tournament_id } = useLocalSearchParams();
  const router = useRouter();
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<any>(null);

  useEffect(() => {
    useEffect(() => {
      fetchRegistrations();
    }, [tournament_id]);
  }, []);

  async function fetchRegistrations() {
    const { data: t } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournament_id)
      .single();

    if (t) setTournament(t);

    const { data, error } = await supabase
      .from('registrations')
      .select('*, teams(name, team_members(in_game_name, player_uid))')
      .eq('tournament_id', tournament_id)
      .order('created_at', { ascending: false });

    if (error) console.log('Registration error:', error.message);
    if (data) setRegistrations(data);
    setLoading(false);
  }

  const getGameColor = (game: string) => {
    const g = game?.toLowerCase() ?? '';
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

  const gameColor = getGameColor(tournament?.game ?? '');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Tournament Info */}
      <View style={styles.tournamentInfo}>
        <View style={[styles.gameTag, { backgroundColor: gameColor + '22' }]}>
          <Text style={[styles.gameTagText, { color: gameColor }]}>
            {tournament?.game?.toUpperCase() ?? ''}
          </Text>
        </View>
        <Text style={styles.tournamentTitle}>{tournament?.title ?? 'Registrations'}</Text>
        <Text style={styles.regCount}>
          {registrations.length} / {tournament?.max_teams} teams registered
        </Text>

        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${Math.min((registrations.length / (tournament?.max_teams || 1)) * 100, 100)}%` as any,
            backgroundColor: gameColor,
          }]} />
        </View>
      </View>

      {/* Registrations List */}
      <FlatList
        data={registrations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No teams registered yet.</Text>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.card, { borderLeftColor: gameColor, borderLeftWidth: 4 }]}>
            <View style={styles.cardHeader}>
              <View style={styles.teamNameRow}>
                <View style={styles.teamNumber}>
                  <Text style={styles.teamNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.teamName}>
                  {item.teams?.name ?? 'Unknown Team'}
                </Text>
              </View>
              <View style={[
                styles.badge,
                item.status === 'confirmed' ? styles.badgeConfirmed : styles.badgePending
              ]}>
                <Text style={styles.badgeText}>{(item.status ?? 'pending').toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {item.teams?.team_members?.map((member: any, i: number) => (
              <View key={i} style={styles.memberRow}>
                <View style={[styles.memberIndex, { backgroundColor: gameColor }]}>
                  <Text style={styles.memberIndexText}>{i + 1}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.in_game_name}</Text>
                  <Text style={styles.memberUid}>UID: {member.player_uid}</Text>
                </View>
                {i === 0 && (
                  <View style={styles.captainBadge}>
                    <Text style={styles.captainText}>CAPTAIN</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 8 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { color: '#7C3AED', fontSize: 15, fontWeight: '600' },
  tournamentInfo: { paddingHorizontal: 24, paddingBottom: 16 },
  gameTag: {
    alignSelf: 'flex-start', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 6, marginBottom: 8,
  },
  gameTagText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  tournamentTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 4 },
  regCount: { fontSize: 13, color: '#aaa', marginBottom: 10 },
  progressBar: {
    height: 4, backgroundColor: '#1a1a1a',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  listContent: { padding: 24, paddingTop: 8 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  teamNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  teamNumber: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2a2a2a', justifyContent: 'center',
    alignItems: 'center', marginRight: 10,
  },
  teamNumberText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  teamName: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgePending: { backgroundColor: '#3a2a00' },
  badgeConfirmed: { backgroundColor: '#0a3a0a' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginBottom: 12 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
  },
  memberIndex: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  memberIndexText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  memberInfo: { flex: 1 },
  memberName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  memberUid: { color: '#555', fontSize: 11, marginTop: 1 },
  captainBadge: {
    backgroundColor: '#7C3AED22', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: '#7C3AED',
  },
  captainText: { color: '#7C3AED', fontSize: 9, fontWeight: '800' },
});