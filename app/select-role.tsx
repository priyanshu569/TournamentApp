import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FragifyLogo from '@/components/FragifyLogo';

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
      .upsert({
        id: userData.user.id,
        role,
      });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.replace('/edit-profile');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <FragifyLogo size={56} />
        <Text style={styles.appName}>FRAGIFY</Text>
      </View>

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

      {loading && (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 20 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0a0a0a' },
  logoBox: { alignItems: 'center', marginBottom: 32 },
  appName: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 3, marginTop: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#aaa', marginBottom: 32, textAlign: 'center' },
  card: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 16,
  },
  cardEmoji: { fontSize: 40, marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#aaa', textAlign: 'center' },
});