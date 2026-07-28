import { supabase } from '@/lib/supabase';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import VerifiedBadge from '@/components/VerifiedBadge';
import NotificationBell from '@/components/NotificationBell';
import FragifyLogo from '@/components/FragifyLogo';
import ShimmerSweep from '@/components/ShimmerSweep';
import LeaderboardIcon from '@/components/LeaderboardIcon';
import GradientIconBadge from '@/components/GradientIconBadge';
import { useTabNavigation } from '@/lib/tabNavigation';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const GAME_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'free fire': 'flame',
  'bgmi': 'skull',
  'cod': 'skull',
  'valorant': 'flash',
};

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [role, setRole] = useState<string | null>(null);
  const [hostStatus, setHostStatus] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const tabNav = useTabNavigation();

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from('Profiles')
      .select('role, display_name, host_status')
      .eq('id', userData.user.id)
      .single();

    if (profile) {
      setRole(profile.role);
      setDisplayName(profile.display_name || '');
      setHostStatus(profile.host_status);
    }

    const isHost = profile?.role === 'host';
    const query = supabase
      .from('tournaments')
      .select('*, host:public_profiles!host_id(display_name, is_verified)')
      .order('created_at', { ascending: false });

    if (isHost) query.eq('host_id', userData.user.id);

    const { data: tournamentData } = await query;
    if (tournamentData) {
      setTournaments(tournamentData);
    }

    setLoading(false);
  }

  const getGameColor = (game: string) => {
    const g = game.toLowerCase();
    if (g.includes('free fire') || g.includes('freefire')) return '#FF6B35';
    if (g.includes('bgmi')) return '#FFB800';
    if (g.includes('cod')) return '#00D4AA';
    if (g.includes('valorant')) return '#FF4655';
    return '#7C3AED';
  };

  const getGameIcon = (game: string): keyof typeof Ionicons.glyphMap => {
    const g = game.toLowerCase();
    for (const key in GAME_ICONS) {
      if (g.includes(key)) return GAME_ICONS[key];
    }
    return 'game-controller';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const isHost = role === 'host';
  const liveNow = tournaments.filter((t) => t.status === 'ongoing');
  const startingSoon = [...tournaments.filter((t) => t.status === 'upcoming')]
    .sort((a, b) => new Date(a.start_time ?? 0).getTime() - new Date(b.start_time ?? 0).getTime())
    .slice(0, 10);
  const bigPrizePools = [...tournaments]
    .sort((a, b) => (b.prize_pool ?? 0) - (a.prize_pool ?? 0))
    .slice(0, 10);
  const canBecomeHost = !isHost && hostStatus !== 'pending';

  const quickActions = [
    { key: 'leaderboard', label: 'Leaderboard', onPress: () => router.push('/leaderboard') },
    { key: 'history', label: isHost ? 'Tournaments' : 'Registrations', onPress: () => tabNav?.goToTab('history') },
    { key: 'chat', label: 'Chats', onPress: () => tabNav?.goToTab('chat') },
    ...(canBecomeHost
      ? [{ key: 'host', label: 'Become a Host', onPress: () => router.push('/request-host-access') }]
      : []),
  ];

  function renderCompactCard(item: any, variant: 'live' | 'soon' | 'prize') {
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.compactCard}
        onPress={() => router.push(`/tournament-details?id=${item.id}`)}
      >
        {item.banner_url ? (
          <Image source={{ uri: item.banner_url }} style={styles.compactBanner} contentFit="cover" />
        ) : (
          <View style={[styles.compactBannerFallback, { backgroundColor: getGameColor(item.game) + '22' }]}>
            <Ionicons name={getGameIcon(item.game)} size={32} color={getGameColor(item.game)} />
          </View>
        )}
        <View style={styles.compactBody}>
          <View style={[styles.gameTag, { backgroundColor: getGameColor(item.game) + '22' }]}>
            <Text style={[styles.gameTagText, { color: getGameColor(item.game) }]}>{item.game.toUpperCase()}</Text>
          </View>
          <Text style={styles.compactTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.hostRow}>
            <Text style={styles.hostName} numberOfLines={1}>by {item.host?.display_name}</Text>
            {item.host?.is_verified && <VerifiedBadge size={11} />}
          </View>
          {variant === 'soon' && (
            <Text style={styles.compactMeta}>🗓 {formatDate(item.start_time)}</Text>
          )}
          {variant === 'prize' && (
            <Text style={styles.compactPrize}>₹{item.prize_pool} PRIZE</Text>
          )}
          {variant === 'live' && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderSection(title: string, emoji: string, data: any[], variant: 'live' | 'soon' | 'prize') {
    if (data.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{emoji} {title}</Text>
          <TouchableOpacity onPress={() => tabNav?.goToTab('events')}>
            <Text style={styles.sectionSeeAll}>See All →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          {data.map((item) => renderCompactCard(item, variant))}
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.headerWrap}>
        <ShimmerSweep style={styles.header}>
          <View style={styles.headerLeft}>
            <FragifyLogo size={40} />
            <View>
              <Text style={styles.appName}>FRAGIFY</Text>
              <Text style={styles.appTagline}>ESPORTS · COMPETE · WIN</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <NotificationBell />
          </View>
        </ShimmerSweep>
      </View>

      {/* Hero */}
      <LinearGradient
        colors={['#7C3AED', '#4C1D95']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroGreeting}>
          {isHost ? `Welcome back, ${displayName} 🏆` : `Hey ${displayName} 🎮`}
        </Text>
        <Text style={styles.heroSub}>
          {isHost ? 'Manage your tournaments and grow your community' : 'Find your next tournament and claim victory'}
        </Text>

        <View style={styles.heroPill}>
          {liveNow.length > 0 ? (
            <>
              <View style={styles.heroLiveDot} />
              <Text style={styles.heroPillText}>{liveNow.length} tournament{liveNow.length !== 1 ? 's' : ''} live right now</Text>
            </>
          ) : (
            <Text style={styles.heroPillText}>No tournaments live right now</Text>
          )}
        </View>

        {isHost && (
          <TouchableOpacity style={styles.createButton} onPress={() => router.push('/create-tournament')}>
            <Ionicons name="add-circle" size={18} color={colors.accent} />
            <Text style={styles.createButtonText}>Create Tournament</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Quick Actions */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsRow}>
        {quickActions.map((action) => (
          <TouchableOpacity key={action.key} style={styles.quickAction} onPress={action.onPress}>
            <View style={styles.quickActionBadge}>
              {action.key === 'leaderboard' && <LeaderboardIcon size={52} />}
              {action.key === 'history' && (
                <GradientIconBadge
                  icon="time"
                  size={52}
                  colors={['#7BFFE0', '#00D4AA', '#00695C']}
                  iconColor="#00332b"
                  glowColor="#00D4AA"
                />
              )}
              {action.key === 'chat' && (
                <GradientIconBadge
                  icon="chatbubbles"
                  size={52}
                  colors={['#9B6BFF', '#7C3AED', '#4C1D95']}
                  glowColor="#7C3AED"
                />
              )}
              {action.key === 'host' && (
                <GradientIconBadge
                  icon="megaphone"
                  size={52}
                  colors={['#FFA36B', '#FF6B35', '#C43E13']}
                  glowColor="#FF6B35"
                />
              )}
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={2}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tournaments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="game-controller-outline" size={48} color="#333" />
          <Text style={styles.emptyText}>
            {isHost ? 'No tournaments yet. Create one!' : 'No tournaments available yet.'}
          </Text>
          {!isHost && (
            <TouchableOpacity style={styles.emptyBtn} onPress={() => tabNav?.goToTab('events')}>
              <Text style={styles.emptyBtnText}>Browse Events</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {renderSection(isHost ? 'Live Now' : 'Live Now', '🔴', liveNow, 'live')}
          {renderSection('Starting Soon', '⚡', startingSoon, 'soon')}
          {renderSection('Big Prize Pools', '💰', bigPrizePools, 'prize')}
        </>
      )}
    </ScrollView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 32 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    headerWrap: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 16,
      borderWidth: 1, borderColor: colors.borderMuted,
      paddingHorizontal: 16, paddingVertical: 12,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    appName: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', letterSpacing: 2 },
    appTagline: { color: colors.textFaint, fontSize: 9, letterSpacing: 1.5, marginTop: 1 },

    hero: {
      marginHorizontal: 24, borderRadius: 20, padding: 22, marginBottom: 20,
    },
    heroGreeting: { color: '#fff', fontSize: 21, fontWeight: '800', marginBottom: 4 },
    heroSub: { color: '#E9DDFF', fontSize: 13, marginBottom: 14 },
    heroPill: {
      flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
      backgroundColor: '#00000033', paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 20, gap: 6,
    },
    heroLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#00D4AA' },
    heroPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    createButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: '#fff', paddingVertical: 13, borderRadius: 12, marginTop: 16,
    },
    createButtonText: { color: colors.accent, fontSize: 15, fontWeight: '800' },

    quickActionsRow: { paddingHorizontal: 24, gap: 18, paddingTop: 12, paddingBottom: 24 },
    quickAction: { alignItems: 'center', width: 80 },
    quickActionBadge: { marginBottom: 6 },
    quickActionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', textAlign: 'center' },

    section: { marginBottom: 24 },
    sectionHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 24, marginBottom: 12,
    },
    sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
    sectionSeeAll: { color: colors.accent, fontSize: 12, fontWeight: '700' },
    horizontalList: { paddingHorizontal: 24, gap: 12 },

    compactCard: {
      width: 220, backgroundColor: colors.surfaceAlt, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    compactBanner: { width: '100%', height: 90 },
    compactBannerFallback: { width: '100%', height: 90, justifyContent: 'center', alignItems: 'center' },
    compactBody: { padding: 12 },
    gameTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
    gameTagText: { fontSize: 9, fontWeight: '800' },
    compactTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 4 },
    hostRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
    hostName: { fontSize: 11, color: colors.textTertiary, fontWeight: '600' },
    compactMeta: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
    compactPrize: { color: colors.warning, fontSize: 12, fontWeight: '800' },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
    liveBadgeText: { color: colors.success, fontSize: 11, fontWeight: '800' },

    emptyContainer: { alignItems: 'center', marginTop: 40, paddingHorizontal: 24 },
    emptyText: { color: colors.textFaint, textAlign: 'center', marginTop: 12, fontSize: 14 },
    emptyBtn: { marginTop: 16, backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  });
}
