import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SelectRoleScreen() {
  const [loading, setLoading] = useState(false);

  async function chooseRole(role: 'player' | 'host') {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      Alert.alert('Error', 'Not logged in');
      return;
    }

    const { error } = await supabase
      .from('Profiles')
      .update({ role })
      .eq('id', userData.user.id);

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.replace('/profile');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How do you want to use the app?</Text>
      <Text style={styles.subtitle}>You can always switch later in settings</Text>

      <TouchableOpacity style={styles.card} onPress={() => chooseRole('player')} disabled={loading}>
        <Text style={styles.cardEmoji}>🎮</Text>
        <Text style={styles.cardTitle}>I'm a Player</Text>
        <Text style={styles.cardDesc}>Join teams and compete in tournaments</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => chooseRole('host')} disabled={loading}>
        <Text style={styles.cardEmoji}>🏆</Text>
        <Text style={styles.cardTitle}>I'm a Host</Text>
        <Text style={styles.cardDesc}>Create and manage tournaments</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 32, textAlign: 'center' },
  card: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 16 },
  cardEmoji: { fontSize: 40, marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#666', textAlign: 'center' },
});