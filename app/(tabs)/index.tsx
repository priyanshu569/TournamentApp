import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('Profiles')
      .select('role, username')
      .eq('id', userData.user.id)
      .single();

    if (profile) {
      setRole(profile.role);
      setUsername(profile.username || '');
    }

    const { data: tournamentData } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

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

        <TouchableOpacity style={styles.createButton}>
          <Text style={styles.createButtonText}>+ Create Tournament</Text>
        </TouchableOpacity>

        {tournaments.length === 0 ? (
          <Text style={styles.emptyText}>You haven't created any tournaments yet.</Text>
        ) : (
          <FlatList
            data={tournaments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSub}>{item.game} • {item.status}</Text>
              </View>
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
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSub}>{item.game} • Entry: ₹{item.entry_fee}</Text>
            </View>
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
});