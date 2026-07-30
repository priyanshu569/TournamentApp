import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';
WebBrowser.maybeCompleteAuthSession();

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, colors, setTheme } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifyTournamentUpdates, setNotifyTournamentUpdates] = useState(true);
  const [notifyRoomCodes, setNotifyRoomCodes] = useState(true);
  const [notifyResults, setNotifyResults] = useState(true);
  const [notifyChatMessages, setNotifyChatMessages] = useState(true);
  const [notifySocial, setNotifySocial] = useState(true);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [followListPrivate, setFollowListPrivate] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      setPhone(userData.user.phone || 'Not linked');

      const { data: profile } = await supabase
        .from('Profiles')
        .select('username, display_name, role, follow_list_private, push_enabled, notify_tournament_updates, notify_room_codes, notify_results, notify_chat_messages, notify_social')
        .eq('id', userData.user.id)
        .single();

      if (profile) {
        setUsername(profile.username || '');
        setDisplayName(profile.display_name || '');
        setRole(profile.role || '');
        setFollowListPrivate(!!profile.follow_list_private);
        setNotificationsEnabled(profile.push_enabled !== false);
        setNotifyTournamentUpdates(profile.notify_tournament_updates !== false);
        setNotifyRoomCodes(profile.notify_room_codes !== false);
        setNotifyResults(profile.notify_results !== false);
        setNotifyChatMessages(profile.notify_chat_messages !== false);
        setNotifySocial(profile.notify_social !== false);
      }

      const { data: identitiesData } = await supabase.auth.getUserIdentities();
      setGoogleLinked(!!identitiesData?.identities?.some((i) => i.provider === 'google'));
    }

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('Profiles')
      .update({ push_enabled: value })
      .eq('id', user.id);

    if (error) {
      setNotificationsEnabled(!value);
      Alert.alert('Error', error.message);
    }
  }

  async function toggleNotifyCategory(
    column: 'notify_tournament_updates' | 'notify_room_codes' | 'notify_results' | 'notify_chat_messages' | 'notify_social',
    setter: (v: boolean) => void,
    value: boolean
  ) {
    setter(value);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('Profiles')
      .update({ [column]: value })
      .eq('id', user.id);

    if (error) {
      setter(!value);
      Alert.alert('Error', error.message);
    }
  }

  async function toggleFollowListPrivate(value: boolean) {
    setFollowListPrivate(value);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('Profiles')
      .update({ follow_list_private: value })
      .eq('id', user.id);

    if (error) {
      setFollowListPrivate(!value);
      Alert.alert('Error', error.message);
    }
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
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Account Details */}
      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Display Name</Text>
          <Text style={styles.rowValue}>{displayName || '—'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Username</Text>
          <Text style={styles.rowValue}>{username ? `@${username}` : '—'}</Text>
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
            <Text style={[styles.rowValue, { color: colors.success }]}>✓ Linked</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.row} onPress={handleLinkGoogle} disabled={linkingGoogle}>
            <Text style={styles.rowLabel}>Link Google Account</Text>
            {linkingGoogle
              ? <ActivityIndicator size="small" color={colors.accent} />
              : <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
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
            <Text style={styles.rowSubLabel}>Master switch -- turning this off silences everything below</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.divider} />
        <View style={[styles.row, !notificationsEnabled && styles.rowDisabled]}>
          <Text style={styles.rowLabel}>Tournament Updates</Text>
          <Switch
            value={notifyTournamentUpdates}
            onValueChange={(v) => toggleNotifyCategory('notify_tournament_updates', setNotifyTournamentUpdates, v)}
            disabled={!notificationsEnabled}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.divider} />
        <View style={[styles.row, !notificationsEnabled && styles.rowDisabled]}>
          <Text style={styles.rowLabel}>Room Codes</Text>
          <Switch
            value={notifyRoomCodes}
            onValueChange={(v) => toggleNotifyCategory('notify_room_codes', setNotifyRoomCodes, v)}
            disabled={!notificationsEnabled}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.divider} />
        <View style={[styles.row, !notificationsEnabled && styles.rowDisabled]}>
          <Text style={styles.rowLabel}>Results</Text>
          <Switch
            value={notifyResults}
            onValueChange={(v) => toggleNotifyCategory('notify_results', setNotifyResults, v)}
            disabled={!notificationsEnabled}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.divider} />
        <View style={[styles.row, !notificationsEnabled && styles.rowDisabled]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Chat Messages</Text>
            <Text style={styles.rowSubLabel}>Can also be muted per-chat from the Chats tab</Text>
          </View>
          <Switch
            value={notifyChatMessages}
            onValueChange={(v) => toggleNotifyCategory('notify_chat_messages', setNotifyChatMessages, v)}
            disabled={!notificationsEnabled}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.divider} />
        <View style={[styles.row, !notificationsEnabled && styles.rowDisabled]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Message Requests</Text>
            <Text style={styles.rowSubLabel}>First-time messages from people you haven't chatted with</Text>
          </View>
          <Switch
            value={notifySocial}
            onValueChange={(v) => toggleNotifyCategory('notify_social', setNotifySocial, v)}
            disabled={!notificationsEnabled}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Privacy */}
      <Text style={styles.sectionLabel}>PRIVACY</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Private Follower/Following List</Text>
            <Text style={styles.rowSubLabel}>Only you (and admins) can see who follows you or who you follow</Text>
          </View>
          <Switch
            value={followListPrivate}
            onValueChange={toggleFollowListPrivate}
            trackColor={{ false: colors.border, true: colors.accent }}
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
            value={theme === 'dark'}
            onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Legal & Account Management */}
      <Text style={styles.sectionLabel}>LEGAL & ACCOUNT</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/privacy-policy')}
        >
          <Text style={styles.rowLabel}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} disabled={deleting}>
          <Text style={[styles.rowLabel, { color: colors.error }]}>Delete Account</Text>
          {deleting
            ? <ActivityIndicator size="small" color={colors.error} />
            : <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 48 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
    sectionLabel: {
      fontSize: 12, color: colors.textMuted, fontWeight: '700',
      marginHorizontal: 24, marginBottom: 8, marginTop: 16, letterSpacing: 1,
    },
    card: {
      backgroundColor: colors.surface, marginHorizontal: 24, borderRadius: 14,
      borderWidth: 1, borderColor: colors.borderMuted, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
    },
    rowDisabled: { opacity: 0.4 },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
    rowLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    rowSubLabel: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
    rowValue: { color: colors.textSecondary, fontSize: 14 },
  });
}
