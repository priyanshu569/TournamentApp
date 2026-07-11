import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import NotificationBell from '@/components/NotificationBell';
import Avatar from '@/components/Avatar';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ tournaments: 0, confirmed: 0 });
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
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

    const { count: followers } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userData.user.id);

    const { count: following } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userData.user.id);

    setFollowCounts({ followers: followers ?? 0, following: following ?? 0 });

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

  async function handleSwitchRole() {
    Alert.alert('Switch Role', 'Preview the app as a different role.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Player', onPress: () => switchRole('player') },
      { text: 'Host', onPress: () => switchRole('host') },
    ]);
  }

  async function switchRole(newRole: 'player' | 'host') {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase
      .from('Profiles')
      .update({ role: newRole })
      .eq('id', userData.user.id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    loadProfile();
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.chatBtn} onPress={() => router.push('/chat')}>
            <Text style={styles.chatIcon}>💬</Text>
          </TouchableOpacity>
          <NotificationBell />
        </View>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Avatar avatarId={profile?.avatar_id} username={profile?.username} size={64} />
        <View style={[styles.profileInfo, { marginLeft: 16 }]}>
          <Text style={styles.username}>{profile?.username ?? 'Unknown'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {profile?.is_admin ? 'ADMIN' : (profile?.role?.toUpperCase() ?? 'PLAYER')}
            </Text>
          </View>
          {profile?.free_fire_uid ? (
            <Text style={styles.uidText}>🎮 Free Fire UID: {profile.free_fire_uid}</Text>
          ) : null}
          {profile?.bgmi_uid ? (
            <Text style={styles.uidText}>🎯 BGMI UID: {profile.bgmi_uid}</Text>
          ) : null}
        </View>
      </View>

      {/* Follow Stats */}
      <View style={styles.followRow}>
        <TouchableOpacity
          style={styles.followStat}
          onPress={() => profile?.id && router.push(`/follow-list?id=${profile.id}&type=followers`)}
        >
          <Text style={styles.followValue}>{followCounts.followers}</Text>
          <Text style={styles.followLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.followStat}
          onPress={() => profile?.id && router.push(`/follow-list?id=${profile.id}&type=following`)}
        >
          <Text style={styles.followValue}>{followCounts.following}</Text>
          <Text style={styles.followLabel}>Following</Text>
        </TouchableOpacity>
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
        {profile?.role !== 'host' && profile?.host_status !== 'pending' && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/request-host-access')}
          >
            <Text style={styles.menuIcon}>🏆</Text>
            <Text style={styles.menuText}>Become a Host</Text>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>
        )}

        {profile?.host_status === 'pending' && (
          <View style={[styles.menuItem, styles.pendingItem]}>
            <Text style={styles.menuIcon}>⏳</Text>
            <Text style={styles.pendingText}>Host Request Pending</Text>
          </View>
        )}

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

        {profile?.is_admin && (
          <TouchableOpacity
            style={[styles.menuItem, styles.adminItem]}
            onPress={() => router.push('/admin-host-requests')}
          >
            <Text style={styles.menuIcon}>🏆</Text>
            <Text style={styles.adminText}>Host Requests</Text>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>
        )}

        {profile?.is_admin && (
          <TouchableOpacity
            style={[styles.menuItem, styles.adminItem]}
            onPress={handleSwitchRole}
          >
            <Text style={styles.menuIcon}>🔄</Text>
            <Text style={styles.adminText}>Switch Role</Text>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>
        )}

        {profile?.is_admin && (
          <TouchableOpacity
            style={[styles.menuItem, styles.adminItem]}
            onPress={() => router.push('/admin-reports')}
          >
            <Text style={styles.menuIcon}>⚠️</Text>
            <Text style={styles.adminText}>Reports</Text>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chatBtn: { padding: 8 },
  chatIcon: { fontSize: 20 },

  uidText: { color: '#aaa', fontSize: 12, marginTop: 4, fontWeight: '600' },

  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  notifBtn: { padding: 8 },
  notifIcon: { fontSize: 22 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', margin: 24, marginTop: 0,
    borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2a2a2a',
  },
  profileInfo: { flex: 1 },
  username: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  roleBadge: {
    alignSelf: 'flex-start', backgroundColor: '#7C3AED22',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1, borderColor: '#7C3AED',
    marginBottom: 4,
  },
  roleText: { color: '#7C3AED', fontSize: 11, fontWeight: '700' },
  followRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 40,
    marginBottom: 20,
  },
  followStat: { alignItems: 'center' },
  followValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  followLabel: { color: '#aaa', fontSize: 12, marginTop: 2 },
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
  pendingItem: { borderColor: '#3a3a00', backgroundColor: '#1a1a00' },
  pendingText: { flex: 1, color: '#FFB800', fontSize: 15, fontWeight: '600' },
  logoutItem: { borderColor: '#3a1a1a' },
  logoutText: { flex: 1, color: '#ff4444', fontSize: 15, fontWeight: '600' },
});