import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FragifyLogo from '@/components/FragifyLogo';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function SelectRoleScreen() {
  const [loading, setLoading] = useState(false);
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

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
          <Ionicons name="game-controller" size={28} color={colors.accent} />
        </View>
        <Text style={styles.cardTitle}>Continue as Player</Text>
        <Text style={styles.cardDesc}>Join teams and compete in tournaments</Text>
      </TouchableOpacity>

      {loading && (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 20 }} />
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

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
    logoBox: { alignItems: 'center', marginBottom: 32 },
    appName: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: 3, marginTop: 8 },
    title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 32, textAlign: 'center' },
    card: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMuted,
      borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
    },
    cardIconCircle: {
      width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentMutedStrong,
      justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    },
    cardTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    cardDesc: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
    hostLink: { marginTop: 24, alignItems: 'center' },
    hostLinkText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  });
}
