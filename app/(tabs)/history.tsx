import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  FlatList, Alert, TouchableOpacity
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function HistoryScreen() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

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
      const { data: regs } = await supabase
        .from('registrations')
        .select('*, teams(name), tournaments(title, game, entry_fee)')
        .eq('player_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (regs) setData(regs);
    } else {
      const { data: tournaments } = await supabase
        .from('tournaments')
        .select('*, registrations(count)')
        .eq('host_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (tournaments) setData(tournaments);
    }

    setLoading(false);
  }

  function confirmCancel(registrationId: string, tournamentTitle: string) {
    Alert.alert(
      'Cancel Registration?',
      `Your team's registration for "${tournamentTitle}" will be removed and your slot freed.`,
      [
        { text: 'Keep Registration', style: 'cancel' },
        { text: 'Cancel Registration', style: 'destructive', onPress: () => doCancel(registrationId) },
      ]
    );
  }

  async function doCancel(registrationId: string) {
    setCancellingId(registrationId);

    const { error } = await supabase.rpc('cancel_registration', {
      p_registration_id: registrationId,
    });

    setCancellingId(null);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setData((prev) => prev.filter((item) => item.id !== registrationId));
      Alert.alert('Cancelled', 'Your registration has been cancelled.');
    }
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
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/tournament-details?id=${item.tournament_id}`)}
              >
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

                {item.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      confirmCancel(item.id, item.tournaments?.title ?? 'this tournament');
                    }}
                    disabled={cancellingId === item.id}
                  >
                    {cancellingId === item.id
                      ? <ActivityIndicator color="#ff4444" size="small" />
                      : <Text style={styles.cancelBtnText}>Cancel Registration</Text>
                    }
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
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
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/tournament-details?id=${item.id}`)}
            >
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
            </TouchableOpacity>
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
  cancelBtn: {
    marginTop: 10, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#1a0a0a',
    borderWidth: 1, borderColor: '#3a1a1a',
  },
  cancelBtnText: { color: '#ff4444', fontSize: 13, fontWeight: '700' },
});