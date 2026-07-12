import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FragifyLogo from '@/components/FragifyLogo';

export default function SelectRoleScreen() {
  const [loading, setLoading] = useState(false);

  async function continueAsPlayer() {
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
        role: 'player',
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

      <Text style={styles.title}>Ready to compete?</Text>
      <Text style={styles.subtitle}>Join teams and battle it out in tournaments</Text>

      <TouchableOpacity style={styles.card} onPress={continueAsPlayer} disabled={loading} activeOpacity={0.85}>
        <View style={styles.cardIconCircle}>
          <Ionicons name="game-controller" size={28} color="#7C3AED" />
        </View>
        <Text style={styles.cardTitle}>Continue as Player</Text>
        <Text style={styles.cardDesc}>Join teams and compete in tournaments</Text>
      </TouchableOpacity>

      {loading && (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 20 }} />
      )}

      <TouchableOpacity
        style={styles.hostLink}
        onPress={() => router.push('/request-host-access')}
        disabled={loading}
      >
        <Text style={styles.hostLinkText}>I'm a host/organiser — Request Access</Text>
      </TouchableOpacity>
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
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626',
    borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  cardIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#7C3AED22',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#aaa', textAlign: 'center' },
  hostLink: { marginTop: 24, alignItems: 'center' },
  hostLinkText: { color: '#7C3AED', fontSize: 13, fontWeight: '600' },
});
