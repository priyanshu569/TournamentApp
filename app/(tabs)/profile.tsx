import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import NotificationBell from '@/components/NotificationBell';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ tournaments: 0, confirmed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }

    const { data: p } = await supabase
      .from('Profiles')
      .select('*')
      .eq('id', userData.user.id)
      .single();

    if (p) setProfile(p);

    if (p?.role === 'player') {
      const { data: regs } = await supabase
        .from('registrations')
        .select('status')
        .eq('player_id', userData.user.id);

      if (regs) {
        setStats({
          tournaments: regs.length,
          confirmed: regs.filter(r => r.status === 'confirmed').length,
        });
      }
    } else {
      const { data: tournaments } = await supabase
        .from('tournaments')
        .select('id')
        .eq('host_id', userData.user.id);

      if (tournaments) {
        setStats({ tournaments: tournaments.length, confirmed: 0 });
      }
    }

    setLoading(false);
  }

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/login');
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? 'NA';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <NotificationBell />
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.username}>{profile?.username ?? 'Unknown'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{profile?.role?.toUpperCase() ?? 'PLAYER'}</Text>
          </View>
          {profile?.free_fire_uid ? (
            <Text style={styles.uidText}>🎮 Free Fire UID: {profile.free_fire_uid}</Text>
          ) : null}
          {profile?.bgmi_uid ? (
            <Text style={styles.uidText}>🎯 BGMI UID: {profile.bgmi_uid}</Text>
          ) : null}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.tournaments}</Text>
          <Text style={styles.statLabel}>
            {profile?.role === 'host' ? 'Tournaments\nCreated' : 'Tournaments\nJoined'}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.confirmed}</Text>
          <Text style={styles.statLabel}>
            {profile?.role === 'host' ? 'Total\nEarnings' : 'Confirmed\nSlots'}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>—</Text>
          <Text style={styles.statLabel}>Win{'\n'}Rate</Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menu}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/select-role')}
        >
          <Text style={styles.menuIcon}>🔄</Text>
          <Text style={styles.menuText}>Switch Role</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/edit-profile')}
        >
          <Text style={styles.menuIcon}>✏️</Text>
          <Text style={styles.menuText}>Edit Profile</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        {profile?.is_admin && (
          <TouchableOpacity
            style={[styles.menuItem, styles.adminItem]}
            onPress={() => router.push('/admin-broadcast')}
          >
            <Text style={styles.menuIcon}>📢</Text>
            <Text style={styles.adminText}>Admin Broadcast</Text>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/settings')}>
          <Text style={styles.menuIcon}>⚙️</Text>
          <Text style={styles.menuText}>Settings</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/support')}>
          <Text style={styles.menuIcon}>❓</Text>
          <Text style={styles.menuText}>Support</Text>
          <Text style={styles.menuArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout}>
          <Text style={styles.menuIcon}>🚪</Text>
          <Text style={styles.logoutText}>Logout</Text>
          <Text style={styles.menuArrow}>→</Text>
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
    alignItems: 'center', padding: 24, paddingTop: 60,
  },

  uidText: { color: '#aaa', fontSize: 12, marginTop: 4, fontWeight: '600' },

  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  notifBtn: { padding: 8 },
  notifIcon: { fontSize: 22 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', margin: 24, marginTop: 0,
    borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2a2a2a',
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#7C3AED', justifyContent: 'center',
    alignItems: 'center', marginRight: 16,
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#fff' },
  profileInfo: { flex: 1 },
  username: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  roleBadge: {
    alignSelf: 'flex-start', backgroundColor: '#7C3AED22',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1, borderColor: '#7C3AED',
    marginBottom: 4,
  },
  roleText: { color: '#7C3AED', fontSize: 11, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', marginHorizontal: 24,
    marginBottom: 24, gap: 12,
  },
  statBox: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#7C3AED', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#aaa', textAlign: 'center', lineHeight: 16 },
  menu: { marginHorizontal: 24, gap: 8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: '#2a2a2a',
  },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  menuArrow: { color: '#555', fontSize: 16 },
  adminItem: { borderColor: '#7C3AED' },
  adminText: { flex: 1, color: '#7C3AED', fontSize: 15, fontWeight: '700' },
  logoutItem: { borderColor: '#3a1a1a' },
  logoutText: { flex: 1, color: '#ff4444', fontSize: 15, fontWeight: '600' },
});