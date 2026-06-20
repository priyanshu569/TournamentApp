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

  useEffect(() => {
    fetchTournament();
  }, []);

  async function fetchTournament() {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) Alert.alert('Error', error.message);
    else setTournament(data);
    setLoading(false);
  }

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{tournament.title}</Text>
      <Text style={styles.game}>{tournament.game}</Text>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>{tournament.status.toUpperCase()}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>₹{tournament.entry_fee}</Text>
          <Text style={styles.statLabel}>Entry Fee</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>₹{tournament.prize_pool}</Text>
          <Text style={styles.statLabel}>Prize Pool</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{tournament.max_teams}</Text>
          <Text style={styles.statLabel}>Max Teams</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.registerButton}
        onPress={() => router.push(`/create-team?tournament_id=${tournament.id}`)}
      >
        <Text style={styles.registerButtonText}>Register Team</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  errorText: { color: '#fff', fontSize: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 6 },
  game: { fontSize: 16, color: '#aaa', marginBottom: 16 },
  badge: {
    alignSelf: 'flex-start', backgroundColor: '#1a1a1a',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: '#7C3AED', marginBottom: 28,
  },
  badgeText: { color: '#7C3AED', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  statBox: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a',
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#aaa' },
  registerButton: {
    backgroundColor: '#7C3AED', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center',
  },
  registerButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});