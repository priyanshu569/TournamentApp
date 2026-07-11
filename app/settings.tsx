import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
WebBrowser.maybeCompleteAuthSession();

const NOTIF_PREF_KEY = 'fragify_notifications_enabled';

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      setPhone(userData.user.phone || 'Not linked');

      const { data: profile } = await supabase
        .from('Profiles')
        .select('username, role')
        .eq('id', userData.user.id)
        .single();

      if (profile) {
        setUsername(profile.username || '');
        setRole(profile.role || '');
      }

      const { data: identitiesData } = await supabase.auth.getUserIdentities();
      setGoogleLinked(!!identitiesData?.identities?.some((i) => i.provider === 'google'));
    }

    const storedPref = await AsyncStorage.getItem(NOTIF_PREF_KEY);
    setNotificationsEnabled(storedPref !== 'false');

    setLoading(false);
  }

  async function handleLinkGoogle() {
    setLinkingGoogle(true);

    const redirectUrl = AuthSession.makeRedirectUri({
      scheme: 'tournamentapp',
      path: 'settings',
    });

    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      setLinkingGoogle(false);
      Alert.alert('Error', error.message);
      return;
    }

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success') {
        Alert.alert('Linked! ✅', 'You can now sign in with Google too.');
        await loadSettings();
      }
    }

    setLinkingGoogle(false);
  }

  async function toggleNotifications(value: boolean) {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem(NOTIF_PREF_KEY, value ? 'true' : 'false');
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and personal info. Your tournament history stays on record (anonymized) so other players\' results aren\'t affected. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: confirmDeleteAccount },
      ]
    );
  }

  async function confirmDeleteAccount() {
    setDeleting(true);

    const { error } = await supabase.rpc('delete_own_account');

    if (error) {
      setDeleting(false);
      Alert.alert('Error', error.message);
      return;
    }

    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Account Details */}
      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Username</Text>
          <Text style={styles.rowValue}>{username || '—'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Phone</Text>
          <Text style={styles.rowValue}>{phone}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Role</Text>
          <Text style={styles.rowValue}>{role ? role.charAt(0).toUpperCase() + role.slice(1) : '—'}</Text>
        </View>
        <View style={styles.divider} />
        {googleLinked ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Google Account</Text>
            <Text style={[styles.rowValue, { color: '#00D4AA' }]}>✓ Linked</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.row} onPress={handleLinkGoogle} disabled={linkingGoogle}>
            <Text style={styles.rowLabel}>Link Google Account</Text>
            {linkingGoogle
              ? <ActivityIndicator size="small" color="#7C3AED" />
              : <Ionicons name="chevron-forward" size={18} color="#555" />
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications */}
      <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Push Notifications</Text>
            <Text style={styles.rowSubLabel}>Tournament updates, room codes, results</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#2a2a2a', true: '#7C3AED' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Appearance */}
      <Text style={styles.sectionLabel}>APPEARANCE</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Dark Mode</Text>
          <Switch
            value={true}
            disabled={true}
            trackColor={{ false: '#2a2a2a', true: '#7C3AED' }}
            thumbColor="#fff"
          />
        </View>
        <Text style={styles.helperText}>Light mode is coming in a future update.</Text>
      </View>

      {/* Legal & Account Management */}
      <Text style={styles.sectionLabel}>LEGAL & ACCOUNT</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/privacy-policy')}
        >
          <Text style={styles.rowLabel}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={18} color="#555" />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} disabled={deleting}>
          <Text style={[styles.rowLabel, { color: '#ff4444' }]}>Delete Account</Text>
          {deleting
            ? <ActivityIndicator size="small" color="#ff4444" />
            : <Ionicons name="chevron-forward" size={18} color="#555" />
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  sectionLabel: {
    fontSize: 12, color: '#666', fontWeight: '700',
    marginHorizontal: 24, marginBottom: 8, marginTop: 16, letterSpacing: 1,
  },
  card: {
    backgroundColor: '#1a1a1a', marginHorizontal: 24, borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginHorizontal: 16 },
  rowLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowSubLabel: { color: '#777', fontSize: 12, marginTop: 2 },
  rowValue: { color: '#aaa', fontSize: 14 },
  helperText: { color: '#555', fontSize: 11, paddingHorizontal: 16, paddingBottom: 12 },
});