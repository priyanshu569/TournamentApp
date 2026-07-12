import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  FlatList, Alert, TouchableOpacity
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

  const isPlayer = role === 'player';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIconBadge}>
          <Ionicons name="time" size={20} color="#00D4AA" />
        </View>
        <View>
          <Text style={styles.heading}>{isPlayer ? 'My Registrations' : 'My Tournaments'}</Text>
          <Text style={styles.sub}>{data.length} tournament{data.length !== 1 ? 's' : ''} {isPlayer ? 'joined' : 'created'}</Text>
        </View>
      </View>

      {isPlayer ? (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="file-tray-outline" size={28} color="#444" />
              </View>
              <Text style={styles.emptyText}>You haven't registered for any tournaments yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/tournament-details?id=${item.tournament_id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.tournamentName} numberOfLines={1}>
                  {item.tournaments?.title ?? 'Unknown Tournament'}
                </Text>
                <View style={[
                  styles.badge,
                  item.status === 'confirmed' ? styles.badgeConfirmed : styles.badgePending
                ]}>
                  <Ionicons
                    name={item.status === 'confirmed' ? 'checkmark-circle' : 'time-outline'}
                    size={12}
                    color={item.status === 'confirmed' ? '#00D4AA' : '#FFB800'}
                  />
                  <Text style={[
                    styles.badgeText,
                    { color: item.status === 'confirmed' ? '#00D4AA' : '#FFB800' }
                  ]}>{item.status.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.cardMetaRow}>
                <Ionicons name="game-controller-outline" size={13} color="#888" />
                <Text style={styles.cardSub}>{item.tournaments?.game ?? '—'}</Text>
              </View>
              <View style={styles.cardMetaRow}>
                <Ionicons name="people-outline" size={13} color="#888" />
                <Text style={styles.cardSub}>Team: {item.teams?.name ?? '—'}</Text>
              </View>
              <View style={styles.cardMetaRow}>
                <Ionicons name="cash-outline" size={13} color="#888" />
                <Text style={styles.cardSub}>Entry Fee: ₹{item.tournaments?.entry_fee ?? 0}</Text>
              </View>

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
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="trophy-outline" size={28} color="#444" />
              </View>
              <Text style={styles.emptyText}>You haven't created any tournaments yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/tournament-details?id=${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.tournamentName} numberOfLines={1}>{item.title}</Text>
                <View style={[
                  styles.badge,
                  item.status === 'upcoming' ? styles.badgePending : styles.badgeConfirmed
                ]}>
                  <Text style={[
                    styles.badgeText,
                    { color: item.status === 'upcoming' ? '#FFB800' : '#00D4AA' }
                  ]}>{item.status.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.cardMetaRow}>
                <Ionicons name="game-controller-outline" size={13} color="#888" />
                <Text style={styles.cardSub}>{item.game}</Text>
              </View>
              <View style={styles.cardMetaRow}>
                <Ionicons name="cash-outline" size={13} color="#888" />
                <Text style={styles.cardSub}>Prize Pool: ₹{item.prize_pool}</Text>
              </View>
              <View style={styles.cardMetaRow}>
                <Ionicons name="people-outline" size={13} color="#888" />
                <Text style={styles.cardSub}>{item.registrations?.[0]?.count ?? 0} / {item.max_teams} teams</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 8,
  elevation: 5,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16,
  },
  headerIconBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#00D4AA18', justifyContent: 'center', alignItems: 'center',
  },
  heading: { fontSize: 22, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 12, color: '#888', marginTop: 2 },
  listContent: { padding: 24, paddingTop: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  emptyText: { color: '#555', fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: '#161616', borderRadius: 14, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: '#262626',
    ...cardShadow,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12, gap: 8,
  },
  tournamentName: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  cardSub: { fontSize: 13, color: '#aaa' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  badgePending: { backgroundColor: '#3a2a0055' },
  badgeConfirmed: { backgroundColor: '#0a3a2a55' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cancelBtn: {
    marginTop: 12, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#1a0a0a',
    borderWidth: 1, borderColor: '#3a1a1a',
  },
  cancelBtnText: { color: '#ff4444', fontSize: 13, fontWeight: '700' },
});
