import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  FlatList, ScrollView
} from 'react-native';
import { supabase } from '@/lib/supabase';

export default function HistoryScreen() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from('Profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (!profile) { setLoading(false); return; }
    setRole(profile.role);

    if (profile.role === 'player') {
      // Fetch player registrations
      const { data: regs } = await supabase
        .from('registrations')
        .select('*, teams(name), tournaments(title, game, entry_fee)')
        .eq('player_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (regs) setData(regs);
    } else {
      // Fetch host tournaments
      const { data: tournaments } = await supabase
        .from('tournaments')
        .select('*, registrations(count)')
        .eq('host_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (tournaments) setData(tournaments);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (role === 'player') {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>My Registrations</Text>
        <Text style={styles.sub}>{data.length} tournament{data.length !== 1 ? 's' : ''} joined</Text>

        {data.length === 0 ? (
          <Text style={styles.emptyText}>You haven't registered for any tournaments yet.</Text>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.tournamentName}>
                    {item.tournaments?.title ?? 'Unknown Tournament'}
                  </Text>
                  <View style={[
                    styles.badge,
                    item.status === 'confirmed' ? styles.badgeConfirmed : styles.badgePending
                  ]}>
                    <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.cardSub}>
                  🎮 {item.tournaments?.game ?? '—'}
                </Text>
                <Text style={styles.cardSub}>
                  👥 Team: {item.teams?.name ?? '—'}
                </Text>
                <Text style={styles.cardSub}>
                  💰 Entry Fee: ₹{item.tournaments?.entry_fee ?? 0}
                </Text>
              </View>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Tournaments</Text>
      <Text style={styles.sub}>{data.length} tournament{data.length !== 1 ? 's' : ''} created</Text>

      {data.length === 0 ? (
        <Text style={styles.emptyText}>You haven't created any tournaments yet.</Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.tournamentName}>{item.title}</Text>
                <View style={[
                  styles.badge,
                  item.status === 'upcoming' ? styles.badgePending : styles.badgeConfirmed
                ]}>
                  <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.cardSub}>🎮 {item.game}</Text>
              <Text style={styles.cardSub}>💰 Prize Pool: ₹{item.prize_pool}</Text>
              <Text style={styles.cardSub}>
                👥 {item.registrations?.[0]?.count ?? 0} / {item.max_teams} teams
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  heading: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 14, color: '#aaa', marginBottom: 24 },
  emptyText: { color: '#555', fontSize: 14, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  tournamentName: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1, marginRight: 8 },
  cardSub: { fontSize: 13, color: '#aaa', marginBottom: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgePending: { backgroundColor: '#3a2a00' },
  badgeConfirmed: { backgroundColor: '#0a3a0a' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
});