import { useEffect, useMemo, useState } from 'react';
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
import AnimatedProfileBanner from '@/components/AnimatedProfileBanner';
import AnimatedAvatarRing from '@/components/AnimatedAvatarRing';
import { BannerTheme } from '@/components/bannerThemes';
import { useTabNavigation } from '@/lib/tabNavigation';
import { isEffectivelyHost } from '@/lib/effectiveRole';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

type MenuAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
};

type MenuSection = {
  title: string;
  items: MenuAction[];
};

export default function ProfileScreen() {
  const router = useRouter();
  const tabNav = useTabNavigation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ tournaments: 0 });
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  // The pager keeps every tab mounted, so re-fetch whenever this tab
  // becomes the visible one again (e.g. after switching role while on
  // another tab) instead of only ever loading once on first mount.
  useEffect(() => {
    if (tabNav?.activeTab === 'profile') {
      loadProfile();
    }
  }, [tabNav?.activeTab]);

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

    const effectiveIsHost = isEffectivelyHost(p);

    if (!effectiveIsHost) {
      const { count: regCount } = await supabase
        .from('registrations')
        .select('id', { count: 'exact', head: true })
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

  // Purely a personal view preference -- never touches role/host_status,
  // so a host browsing as a player (or an admin previewing as a host
  // they aren't) is still shown as their true role everywhere else in
  // the app (world chat, chat, profile badges all read role/is_admin
  // directly and are unaffected by this).
  async function setBrowsingMode(mode: 'player' | 'host' | null) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase
      .from('Profiles')
      .update({ browsing_mode: mode })
      .eq('id', userData.user.id);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    loadProfile();
  }

  function handlePreviewRole() {
    Alert.alert('Preview Role', 'See the app as a different role would.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Player', onPress: () => setBrowsingMode('player') },
      { text: 'Host', onPress: () => setBrowsingMode('host') },
    ]);
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
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const isHost = profile?.role === 'host';
  const isAdmin = !!profile?.is_admin;
  const browsingAsPlayer = isHost && profile?.browsing_mode === 'player';
  const browsingAsHost = !isHost && isAdmin && profile?.browsing_mode === 'host';
  // Admins get an instant preview toggle in Admin Tools instead -- no
  // need to apply and wait for their own approval.
  const canBecomeHost = !isHost && profile?.host_status !== 'pending' && !isAdmin;

  const menuSections: MenuSection[] = [
    {
      title: 'ACCOUNT',
      items: [
        ...(isHost ? [
          browsingAsPlayer
            ? { key: 'view-as-host', icon: 'trophy' as const, color: colors.accent, label: 'Switch to Host View', onPress: () => setBrowsingMode(null) }
            : { key: 'view-as-player', icon: 'person' as const, color: colors.accent, label: 'Switch to Player View', onPress: () => setBrowsingMode('player') }
        ] : []),
        ...(canBecomeHost ? [{
          key: 'become-host', icon: 'trophy' as const, color: colors.warning,
          label: 'Become a Host', onPress: () => router.push('/request-host-access'),
        }] : []),
        { key: 'edit-profile', icon: 'create' as const, color: colors.success, label: 'Edit Profile', onPress: () => router.push('/edit-profile') },
        { key: 'profile-banner', icon: 'sparkles' as const, color: colors.accent, label: 'Profile Banner', onPress: () => router.push('/profile-banner') },
        { key: 'game-details', icon: 'game-controller' as const, color: colors.warning, label: 'My Games', onPress: () => router.push('/game-details') },
      ],
    },
    ...(isAdmin ? [{
      title: 'ADMIN TOOLS',
      items: [
        { key: 'admin-broadcast', icon: 'megaphone' as const, color: colors.accent, label: 'Admin Broadcast', onPress: () => router.push('/admin-broadcast') },
        { key: 'admin-host-requests', icon: 'trophy' as const, color: colors.accent, label: 'Host Requests', onPress: () => router.push('/admin-host-requests') },
        { key: 'switch-role', icon: 'sync' as const, color: colors.accent, label: 'Switch Role', onPress: handlePreviewRole },
        { key: 'admin-reports', icon: 'warning' as const, color: colors.accent, label: 'Reports', onPress: () => router.push('/admin-reports') },
      ],
    }] : []),
    {
      title: 'MORE',
      items: [
        { key: 'settings', icon: 'settings' as const, color: colors.textTertiary, label: 'Settings', onPress: () => router.push('/settings') },
        { key: 'support', icon: 'help-circle' as const, color: '#4FA3FF', label: 'Support', onPress: () => router.push('/support') },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <NotificationBell />
      </View>

      {/* Profile Card */}
      <AnimatedProfileBanner
        theme={(profile?.banner_theme as BannerTheme) ?? null}
        classicColors={['#2d1b4e', '#1a0f2e', '#0d0619']}
        style={styles.profileCard}
      >
        <AnimatedAvatarRing theme={(profile?.banner_theme as BannerTheme) ?? null} size={72}>
          <Avatar avatarId={profile?.avatar_id} avatarUrl={profile?.avatar_url} username={profile?.display_name} size={72} />
        </AnimatedAvatarRing>
        <View style={[styles.profileInfo, { marginLeft: 16 }]}>
          <View style={styles.nameRow}>
            <Text style={styles.username}>{profile?.display_name ?? 'Unknown'}</Text>
          </View>
          {profile?.username && <Text style={styles.handle}>@{profile.username}</Text>}
          <LinearGradient
            colors={profile?.is_admin ? ['#FFE28A', '#F5B93D', '#B8860B'] : ['#7C3AED', '#4C1D95']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.roleBadge}
          >
            <Text style={[styles.roleText, profile?.is_admin && styles.roleTextAdmin]}>
              {profile?.is_admin ? 'ADMIN' : (profile?.role?.toUpperCase() ?? 'PLAYER')}
            </Text>
          </LinearGradient>
          {browsingAsPlayer && <Text style={styles.browsingModeHint}>Browsing as Player</Text>}
          {browsingAsHost && <Text style={styles.browsingModeHint}>Previewing as Host</Text>}
        </View>
      </AnimatedProfileBanner>

      {/* Stats */}
      <View style={styles.statsCard}>
        <TouchableOpacity style={styles.statItem} onPress={() => tabNav?.goToTab('history')} activeOpacity={0.75}>
          <Ionicons name="trophy" size={16} color={colors.accent} style={styles.statIcon} />
          <Text style={styles.statValue}>{stats.tournaments}</Text>
          <Text style={styles.statLabel}>
            {(isHost && !browsingAsPlayer) || browsingAsHost ? 'Created' : 'Joined'}
          </Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          activeOpacity={0.75}
          onPress={() => profile?.id && router.push(`/follow-list?id=${profile.id}&type=followers`)}
        >
          <Ionicons name="people" size={16} color={colors.accent} style={styles.statIcon} />
          <Text style={styles.statValue}>{followCounts.followers}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          activeOpacity={0.75}
          onPress={() => profile?.id && router.push(`/follow-list?id=${profile.id}&type=following`)}
        >
          <Ionicons name="person-add" size={16} color={colors.accent} style={styles.statIcon} />
          <Text style={styles.statValue}>{followCounts.following}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
      </View>

      {profile?.host_status === 'pending' && (
        <View style={styles.menuWrap}>
          <View style={[styles.menuItem, styles.pendingItem]}>
            <View style={[styles.menuIconCircle, { backgroundColor: colors.warningMuted, borderColor: colors.warning + '55' }]}>
              <Ionicons name="hourglass" size={18} color={colors.warning} />
            </View>
            <Text style={styles.pendingText}>Host Request Pending</Text>
          </View>
        </View>
      )}

      {/* Menu Sections */}
      {menuSections.map((section) => (
        <View key={section.title} style={styles.menuWrap}>
          <Text style={styles.sectionLabel}>{section.title}</Text>
          <View style={styles.menu}>
            {section.items.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.menuItem}
                onPress={action.onPress}
                activeOpacity={0.8}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: action.color + '1c', borderColor: action.color + '44' }]}>
                  <Ionicons name={action.icon} size={18} color={action.color} />
                </View>
                <Text style={styles.menuText}>{action.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <View style={styles.menuWrap}>
        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout} activeOpacity={0.8}>
          <View style={[styles.menuIconCircle, { backgroundColor: colors.errorMuted, borderColor: colors.error + '44' }]}>
            <Ionicons name="log-out" size={18} color={colors.error} />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.error + '66'} />
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
      alignItems: 'center', padding: 24, paddingTop: 60,
    },
    headerTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },

    handle: { color: '#c9b8ea', fontSize: 13, fontWeight: '600', marginBottom: 8 },

    profileCard: {
      flexDirection: 'row', alignItems: 'center',
      margin: 24, marginTop: 0,
      borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#3a2c5c',
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
    },
    avatarRing: {
      padding: 3, borderRadius: 40, borderWidth: 2, borderColor: colors.accent,
    },
    profileInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    username: { fontSize: 20, fontWeight: '800', color: '#fff' },
    roleBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12, paddingVertical: 4,
      borderRadius: 20,
    },
    roleText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    roleTextAdmin: { color: '#4a2f00' },
    browsingModeHint: { color: '#c9b8ea', fontSize: 11, fontWeight: '600', marginTop: 6 },

    statsCard: {
      flexDirection: 'row', marginHorizontal: 24, marginBottom: 24,
      backgroundColor: colors.surface, borderRadius: 20,
      borderWidth: 1, borderColor: colors.borderMuted, paddingVertical: 18,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statIcon: { marginBottom: 6 },
    statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 2 },
    statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 3 },
    statLabel: { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },

    menuWrap: { marginHorizontal: 24, marginBottom: 22 },
    sectionLabel: {
      fontSize: 11, color: colors.textMuted, fontWeight: '700',
      letterSpacing: 1.2, marginBottom: 10, marginLeft: 4,
    },
    menu: { gap: 10 },
    menuItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 16,
      padding: 14, borderWidth: 1, borderColor: colors.borderMuted,
    },
    menuIconCircle: {
      width: 40, height: 40, borderRadius: 20,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1,
    },
    menuText: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    pendingItem: { borderColor: '#3a3a00', backgroundColor: '#1a1a0088' },
    pendingText: { flex: 1, color: colors.warning, fontSize: 15, fontWeight: '600' },
    logoutItem: { borderColor: '#2a1414' },
    logoutText: { flex: 1, color: colors.error, fontSize: 15, fontWeight: '600' },
  });
}
