import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    setUserId(userData.user.id);

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
      .select('*')
      .order('created_at', { ascending: false });

    if (isHost) {
      query.eq('host_id', userData.user.id);
    }

    const { data: tournamentData } = await query;

    if (tournamentData) {
      setTournaments(tournamentData);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#534AB7" />
      </View>
    );
  }

  if (role === 'host') {
    return (
      <View style={styles.container}>
        <Text style={styles.greeting}>Welcome back, {username} 🏆</Text>
        <Text style={styles.sectionTitle}>Your Tournaments</Text>

        <TouchableOpacity style={styles.createButton} onPress={() => router.push('/create-tournament')}>
          <Text style={styles.createButtonText}>+ Create Tournament</Text>
        </TouchableOpacity>

        {tournaments.length === 0 ? (
          <Text style={styles.emptyText}>You haven't created any tournaments yet.</Text>
        ) : (
          <FlatList
            data={tournaments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/tournament-details?id=${item.id}`)}
              >
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSub}>{item.game} • {item.status}</Text>
                <Text style={styles.cardAction}>View Registrations →</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hey {username} 🎮</Text>
      <Text style={styles.sectionTitle}>Open Tournaments</Text>

      {tournaments.length === 0 ? (
        <Text style={styles.emptyText}>No tournaments available right now. Check back soon!</Text>
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/tournament-details?id=${item.id}`)}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSub}>{item.game} • Entry: ₹{item.entry_fee}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  greeting: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '500', color: '#666', marginBottom: 16, marginTop: 8 },
  emptyText: { color: '#999', fontSize: 14, textAlign: 'center', marginTop: 40 },
  createButton: { backgroundColor: '#534AB7', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
  createButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 16, marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#666' },
  cardAction: { fontSize: 12, color: '#534AB7', marginTop: 6, fontWeight: '600' },
});