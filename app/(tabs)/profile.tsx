import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, ScrollView, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import NotificationBell from '@/components/NotificationBell';
import Avatar from '@/components/Avatar';
import { useTabNavigation } from '@/lib/tabNavigation';

type MenuAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
};

export default function ProfileScreen() {
  const router = useRouter();
  const tabNav = useTabNavigation();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ tournaments: 0 });
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
      const { count: regCount } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('player_id', userData.user.id);

      setStats({ tournaments: regCount ?? 0 });
    } else {
      const { count: tournamentCount } = await supabase
        .from('tournaments')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', userData.user.id);

      setStats({ tournaments: tournamentCount ?? 0 });
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
      .update(
        newRole === 'host'
          ? { role: newRole, host_status: 'approved' }
          : { role: newRole }
      )
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

  const canBecomeHost = profile?.role !== 'host' && profile?.host_status !== 'pending';
  const isAdmin = !!profile?.is_admin;

  const menuActions: MenuAction[] = [
    ...(canBecomeHost ? [{
      key: 'become-host', icon: 'trophy' as const, color: '#FFB800',
      label: 'Become a Host', onPress: () => router.push('/request-host-access'),
    }] : []),
    { key: 'edit-profile', icon: 'create' as const, color: '#00D4AA', label: 'Edit Profile', onPress: () => router.push('/edit-profile') },
    ...(isAdmin ? [
      { key: 'admin-broadcast', icon: 'megaphone' as const, color: '#7C3AED', label: 'Admin Broadcast', onPress: () => router.push('/admin-broadcast') },
      { key: 'admin-host-requests', icon: 'trophy' as const, color: '#7C3AED', label: 'Host Requests', onPress: () => router.push('/admin-host-requests') },
      { key: 'switch-role', icon: 'sync' as const, color: '#7C3AED', label: 'Switch Role', onPress: handleSwitchRole },
      { key: 'admin-reports', icon: 'warning' as const, color: '#7C3AED', label: 'Reports', onPress: () => router.push('/admin-reports') },
    ] : []),
    { key: 'settings', icon: 'settings' as const, color: '#888', label: 'Settings', onPress: () => router.push('/settings') },
    { key: 'support', icon: 'help-circle' as const, color: '#4FA3FF', label: 'Support', onPress: () => router.push('/support') },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <NotificationBell />
      </View>

      {/* Profile Card */}
      <LinearGradient
        colors={['#241a3a', '#150f24']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileCard}
      >
        <Avatar avatarId={profile?.avatar_id} username={profile?.username} size={68} />
        <View style={[styles.profileInfo, { marginLeft: 16 }]}>
          <Text style={styles.username}>{profile?.username ?? 'Unknown'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {profile?.is_admin ? 'ADMIN' : (profile?.role?.toUpperCase() ?? 'PLAYER')}
            </Text>
          </View>
          {profile?.free_fire_uid ? (
            <View style={styles.uidRow}>
              <Ionicons name="flame" size={12} color="#FF6B35" />
              <Text style={styles.uidText}>Free Fire: {profile.free_fire_uid}</Text>
            </View>
          ) : null}
          {profile?.bgmi_uid ? (
            <View style={styles.uidRow}>
              <Ionicons name="skull" size={12} color="#FFB800" />
              <Text style={styles.uidText}>BGMI: {profile.bgmi_uid}</Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statBox} onPress={() => tabNav?.goToTab('history')} activeOpacity={0.8}>
          <Text style={styles.statValue}>{stats.tournaments}</Text>
          <Text style={styles.statLabel}>
            {profile?.role === 'host' ? 'Tournaments\nCreated' : 'Tournaments\nJoined'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statBox}
          activeOpacity={0.8}
          onPress={() => profile?.id && router.push(`/follow-list?id=${profile.id}&type=followers`)}
        >
          <Text style={styles.statValue}>{followCounts.followers}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statBox}
          activeOpacity={0.8}
          onPress={() => profile?.id && router.push(`/follow-list?id=${profile.id}&type=following`)}
        >
          <Text style={styles.statValue}>{followCounts.following}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Items */}
      <View style={styles.menu}>
        {profile?.host_status === 'pending' && (
          <View style={[styles.menuItem, styles.pendingItem]}>
            <View style={[styles.menuIconCircle, { backgroundColor: '#FFB80022' }]}>
              <Ionicons name="hourglass" size={18} color="#FFB800" />
            </View>
            <Text style={styles.pendingText}>Host Request Pending</Text>
          </View>
        )}

        {menuActions.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={styles.menuItem}
            onPress={action.onPress}
            activeOpacity={0.8}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: action.color + '22' }]}>
              <Ionicons name={action.icon} size={18} color={action.color} />
            </View>
            <Text style={styles.menuText}>{action.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#444" />
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout} activeOpacity={0.8}>
          <View style={[styles.menuIconCircle, { backgroundColor: '#ff444422' }]}>
            <Ionicons name="log-out" size={18} color="#ff4444" />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
          <Ionicons name="chevron-forward" size={18} color="#442222" />
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
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },

  uidRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  uidText: { color: '#aaa', fontSize: 12, fontWeight: '600' },

  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    margin: 24, marginTop: 0,
    borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#2f2447',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  profileInfo: { flex: 1 },
  username: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
  roleBadge: {
    alignSelf: 'flex-start', backgroundColor: '#7C3AED33',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1, borderColor: '#7C3AED',
    marginBottom: 2,
  },
  roleText: { color: '#B794F6', fontSize: 11, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', marginHorizontal: 24,
    marginBottom: 24, gap: 12,
  },
  statBox: {
    flex: 1, backgroundColor: '#161616', borderRadius: 14,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#262626',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#7C3AED', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#aaa', textAlign: 'center', lineHeight: 16 },
  menu: { marginHorizontal: 24, gap: 10 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#161616', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#262626',
  },
  menuIconCircle: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },
  menuText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  pendingItem: { borderColor: '#3a3a00', backgroundColor: '#1a1a0088' },
  pendingText: { flex: 1, color: '#FFB800', fontSize: 15, fontWeight: '600' },
  logoutItem: { borderColor: '#2a1414' },
  logoutText: { flex: 1, color: '#ff4444', fontSize: 15, fontWeight: '600' },
});
