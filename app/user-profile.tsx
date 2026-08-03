import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import VerifiedBadge from '@/components/VerifiedBadge';
import AnimatedProfileBanner from '@/components/AnimatedProfileBanner';
import AnimatedAvatarRing from '@/components/AnimatedAvatarRing';
import PremiumShimmer from '@/components/premium/PremiumShimmer';
import { BannerTheme, PREMIUM_THEMES } from '@/components/bannerThemes';
import { useAvatarPreview } from '@/lib/AvatarPreviewContext';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const GAME_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  'Free Fire': { icon: 'flame', color: '#FF6B35' },
  'BGMI': { icon: 'skull', color: '#FFB800' },
  'COD Mobile': { icon: 'skull', color: '#00D4AA' },
  'Valorant': { icon: 'flash', color: '#FF4655' },
};

function getGenderMeta(gender: string | null, colors: ThemeColors) {
  if (gender === 'male') return { icon: 'male' as const, color: '#4FA3FF' };
  if (gender === 'female') return { icon: 'female' as const, color: '#FF6FA5' };
  if (gender === 'other') return { icon: 'person' as const, color: colors.textTertiary };
  return null;
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const showAvatarPreview = useAvatarPreview();
  const [profile, setProfile] = useState<any>(null);
  const [games, setGames] = useState<any[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [theyFollowMe, setTheyFollowMe] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [listsPrivate, setListsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id ?? null;
    setMyId(me);

    if (me) {
      const { data: myProfile } = await supabase
        .from('Profiles')
        .select('is_admin')
        .eq('id', me)
        .single();
      setIsAdmin(!!myProfile?.is_admin);
    }

    const { data: p } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('id', id)
      .single();
    setProfile(p);
    setListsPrivate(!!p?.follow_list_private);

    const { data: gameRows } = await supabase
      .from('game_profiles')
      .select('game, in_game_name, game_uid')
      .eq('user_id', id);
    setGames(gameRows ?? []);

    if (me && me !== id) {
      const { data: followRow } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', me)
        .eq('following_id', id)
        .maybeSingle();
      setIsFollowing(!!followRow);

      const { data: followsMeRow } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', id)
        .eq('following_id', me)
        .maybeSingle();
      setTheyFollowMe(!!followsMeRow);

      const { data: blockRow } = await supabase
        .from('blocks')
        .select('id')
        .eq('blocker_id', me)
        .eq('blocked_id', id)
        .maybeSingle();
      setIsBlocked(!!blockRow);
    }

    const { count: followers } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', id);
    setFollowersCount(followers ?? 0);

    const { count: following } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', id);
    setFollowingCount(following ?? 0);

    setLoading(false);
  }

  async function toggleFollow() {
    if (!myId) return;
    setActionLoading(true);

    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', id);
      setIsFollowing(false);
      setFollowersCount((c) => Math.max(0, c - 1));
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: myId, following_id: id });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setIsFollowing(true);
        setFollowersCount((c) => c + 1);
      }
    }

    setActionLoading(false);
  }

  async function handleMessage() {
    setActionLoading(true);
    const { data: conversationId, error } = await supabase.rpc('start_direct_conversation', {
      other_user_id: id,
    });
    setActionLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    router.push(`/chat-thread?id=${conversationId}`);
  }

  function handleBlockToggle() {
    Alert.alert(
      isBlocked ? 'Unblock User' : 'Block User',
      isBlocked
        ? 'They will be able to message you again.'
        : "They won't be able to message you directly anymore.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isBlocked ? 'Unblock' : 'Block', style: 'destructive', onPress: confirmBlockToggle },
      ]
    );
  }

  async function confirmBlockToggle() {
    if (!myId) return;
    setActionLoading(true);

    if (isBlocked) {
      await supabase.from('blocks').delete().eq('blocker_id', myId).eq('blocked_id', id);
      setIsBlocked(false);
    } else {
      const { error } = await supabase.from('blocks').insert({ blocker_id: myId, blocked_id: id });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setIsBlocked(true);
      }
    }

    setActionLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Profile not found.</Text>
      </View>
    );
  }

  const isOwnProfile = myId === id;
  const canSeeLists = !listsPrivate || isOwnProfile || isAdmin;
  const genderMeta = getGenderMeta(profile.gender, colors);
  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  const isPremiumBanner = PREMIUM_THEMES.includes(profile.banner_theme);
  // Molten gold reads as heat on Dragon's Wrath; white would look like glare.
  const shimmerColor = profile.banner_theme === 'dragonwrath' ? '#FFB43D' : '#FFFFFF';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ width: 36 }} />
      </View>

      {/* Hero */}
      <AnimatedProfileBanner
        theme={(profile.banner_theme as BannerTheme) ?? null}
        classicColors={['#2d1b4e', '#1a0f2e', '#0d0619']}
        style={styles.hero}
      >
        <View style={{ marginBottom: 14 }}>
          <AnimatedAvatarRing theme={(profile.banner_theme as BannerTheme) ?? null} size={84}>
            <TouchableOpacity
              activeOpacity={1}
              onLongPress={() => showAvatarPreview({ avatarId: profile.avatar_id, avatarUrl: profile.avatar_url, username: profile.display_name })}
            >
              <Avatar avatarId={profile.avatar_id} avatarUrl={profile.avatar_url} username={profile.display_name} size={84} />
            </TouchableOpacity>
          </AnimatedAvatarRing>
        </View>
        <PremiumShimmer
          enabled={isPremiumBanner}
          color={shimmerColor}
          style={styles.nameRow}
          periodMs={7000}
        >
          <Text style={styles.username}>{profile.display_name ?? 'Unknown'}</Text>
          {profile.is_verified && (
            <PremiumShimmer
              enabled={isPremiumBanner}
              color={shimmerColor}
              pulse
              periodMs={9400}
              travelMs={800}
              peakOpacity={0.45}
            >
              <VerifiedBadge size={16} />
            </PremiumShimmer>
          )}
        </PremiumShimmer>
        {profile.username && (
          <Text style={styles.handle}>@{profile.username}</Text>
        )}

        {(genderMeta || location || profile.age) && (
          <View style={styles.infoRow}>
            {genderMeta && (
              <View style={styles.infoChip}>
                <Ionicons name={genderMeta.icon} size={13} color={genderMeta.color} />
              </View>
            )}
            {!!location && (
              <View style={styles.infoChip}>
                <Ionicons name="location" size={12} color="#c9b8ea" />
                <Text style={styles.infoChipText}>{location}</Text>
              </View>
            )}
            {!!profile.age && (
              <View style={styles.infoChip}>
                <Text style={styles.infoChipText}>{profile.age} yrs</Text>
              </View>
            )}
          </View>
        )}

        {(profile.is_admin || profile.role) && (
          <LinearGradient
            colors={profile.is_admin ? ['#FFE28A', '#F5B93D', '#B8860B'] : ['#7C3AED', '#4C1D95']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.roleBadge}
          >
            <Text style={[styles.roleText, profile.is_admin && styles.roleTextAdmin]}>
              {profile.is_admin ? 'ADMIN' : profile.role.toUpperCase()}
            </Text>
          </LinearGradient>
        )}
      </AnimatedProfileBanner>

      {/* Stats */}
      <View style={styles.statsCard}>
        <TouchableOpacity
          style={styles.statItem}
          disabled={!canSeeLists}
          onPress={() => router.push(`/follow-list?id=${id}&type=followers`)}
        >
          <Text style={styles.statValue}>{canSeeLists ? followersCount : '—'}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          disabled={!canSeeLists}
          onPress={() => router.push(`/follow-list?id=${id}&type=following`)}
        >
          <Text style={styles.statValue}>{canSeeLists ? followingCount : '—'}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
      </View>
      {!canSeeLists && (
        <Text style={styles.privateHint}>🔒 This user's follower/following lists are private.</Text>
      )}

      {!isOwnProfile && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, isFollowing && styles.actionBtnActive]}
            onPress={toggleFollow}
            disabled={actionLoading}
          >
            <Text style={[styles.actionBtnText, isFollowing && styles.actionBtnTextActive]}>
              {isFollowing ? 'Following' : (theyFollowMe ? 'Follow Back' : 'Follow')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={handleMessage}
            disabled={actionLoading || isBlocked}
          >
            <Text style={styles.actionBtnOutlineText}>Message</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Games */}
      {games.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GAMES</Text>
          <View style={{ gap: 10 }}>
            {games.map((g) => {
              const meta = GAME_META[g.game] ?? { icon: 'game-controller' as const, color: colors.accent };
              return (
                <View key={g.game} style={styles.gameCard}>
                  <View style={[styles.gameIconCircle, { backgroundColor: meta.color + '1c', borderColor: meta.color + '55' }]}>
                    <Ionicons name={meta.icon} size={18} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gameName}>{g.game}</Text>
                    <Text style={styles.gameDetail}>{g.in_game_name} · UID: {g.game_uid}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {!isOwnProfile && (
        <View style={styles.section}>
          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItem} onPress={handleBlockToggle} disabled={actionLoading}>
              <View style={[styles.menuIconCircle, { backgroundColor: colors.errorMuted, borderColor: colors.error + '44' }]}>
                <Ionicons name="ban" size={16} color={colors.error} />
              </View>
              <Text style={styles.menuText}>{isBlocked ? 'Unblock User' : 'Block User'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push(`/report-user?target_user_id=${id}`)}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: colors.warningMuted, borderColor: colors.warning + '44' }]}>
                <Ionicons name="warning" size={16} color={colors.warning} />
              </View>
              <Text style={styles.menuText}>Report User</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    errorText: { color: colors.textPrimary, fontSize: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    hero: {
      alignItems: 'center', borderRadius: 24, padding: 24, marginBottom: 20,
      borderWidth: 1, borderColor: '#3a2c5c',
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
    },
    avatarRing: {
      padding: 3, borderRadius: 46, borderWidth: 2, borderColor: colors.accent, marginBottom: 14,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    username: { fontSize: 22, fontWeight: '900', color: '#fff' },
    handle: { fontSize: 13, color: '#c9b8ea', marginTop: 2, fontWeight: '600' },
    infoRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
    infoChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: '#ffffff14', paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 20, borderWidth: 1, borderColor: '#ffffff1f',
    },
    infoChipText: { color: '#e5d9fb', fontSize: 12, fontWeight: '600' },
    roleBadge: {
      marginTop: 14, paddingHorizontal: 12,
      paddingVertical: 4, borderRadius: 20,
    },
    roleText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    roleTextAdmin: { color: '#4a2f00' },

    statsCard: {
      flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 18,
      borderWidth: 1, borderColor: colors.borderMuted, paddingVertical: 16, marginBottom: 6,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, backgroundColor: colors.border },
    statValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    statLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    privateHint: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 10 },
    actionsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
    actionBtn: {
      flex: 1, backgroundColor: colors.accent, paddingVertical: 14,
      borderRadius: 14, alignItems: 'center',
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
    },
    actionBtnActive: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.accent, shadowOpacity: 0 },
    actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    actionBtnTextActive: { color: colors.accent },
    actionBtnOutline: {
      flex: 1, backgroundColor: colors.surfaceAlt, paddingVertical: 14,
      borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    actionBtnOutlineText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },

    section: { marginTop: 24 },
    sectionLabel: {
      fontSize: 11, color: colors.textMuted, fontWeight: '700',
      letterSpacing: 1.2, marginBottom: 10, marginLeft: 4,
    },
    gameCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 16,
      padding: 14, borderWidth: 1, borderColor: colors.borderMuted,
    },
    gameIconCircle: {
      width: 40, height: 40, borderRadius: 20,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1,
    },
    gameName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 2 },
    gameDetail: { color: colors.textTertiary, fontSize: 12 },

    menu: { gap: 10 },
    menuItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 16,
      padding: 14, borderWidth: 1, borderColor: colors.borderMuted,
    },
    menuIconCircle: {
      width: 34, height: 34, borderRadius: 17,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1,
    },
    menuText: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  });
}
