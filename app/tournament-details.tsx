import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function TournamentDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: profile } = await supabase
        .from('Profiles')
        .select('role')
        .eq('id', userData.user.id)
        .single();
      if (profile) setRole(profile.role);
    }

    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) Alert.alert('Error', error.message);
    else setTournament(data);
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

  if (!tournament) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Tournament not found.</Text>
      </View>
    );
  }

  const gameColor = getGameColor(tournament.game);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Game Tag */}
      <View style={[styles.gameTag, { backgroundColor: gameColor + '22' }]}>
        <Text style={[styles.gameTagText, { color: gameColor }]}>
          {tournament.game.toUpperCase()}
        </Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>{tournament.title}</Text>

      {/* Status Badge */}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { borderColor: gameColor }]}>
          <Text style={[styles.statusText, { color: gameColor }]}>
            {tournament.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { borderTopColor: gameColor }]}>
          <Text style={styles.statValue}>₹{tournament.entry_fee}</Text>
          <Text style={styles.statLabel}>Entry Fee</Text>
        </View>
        <View style={[styles.statBox, { borderTopColor: gameColor }]}>
          <Text style={styles.statValue}>₹{tournament.prize_pool}</Text>
          <Text style={styles.statLabel}>Prize Pool</Text>
        </View>
        <View style={[styles.statBox, { borderTopColor: gameColor }]}>
          <Text style={styles.statValue}>{tournament.max_teams}</Text>
          <Text style={styles.statLabel}>Max Teams</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Action Button */}
      {role === 'host' ? (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: gameColor }]}
          onPress={() => router.push(`/registrations?tournament_id=${tournament.id}`)}
        >
          <Text style={styles.actionButtonText}>View Registrations</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: gameColor }]}
          onPress={() => router.push(`/create-team?tournament_id=${tournament.id}&entry_fee=${tournament.entry_fee}`)}
        >
          <Text style={styles.actionButtonText}>Register Team →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  errorText: { color: '#fff', fontSize: 16 },
  gameTag: {
    alignSelf: 'flex-start', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 8, marginBottom: 16,
  },
  gameTagText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 30, fontWeight: '900', color: '#fff', marginBottom: 16, lineHeight: 36 },
  statusRow: { marginBottom: 24 },
  statusBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 12,
    paddingVertical: 4, borderRadius: 20, borderWidth: 1,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statBox: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, alignItems: 'center', borderWidth: 1,
    borderColor: '#2a2a2a', borderTopWidth: 3,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#aaa' },
  divider: { height: 1, backgroundColor: '#1a1a1a', marginBottom: 24 },
  actionButton: {
    paddingVertical: 16, borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});