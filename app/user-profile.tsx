import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import VerifiedBadge from '@/components/VerifiedBadge';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
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

    if (me && me !== id) {
      const { data: followRow } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', me)
        .eq('following_id', id)
        .maybeSingle();
      setIsFollowing(!!followRow);

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
        <ActivityIndicator size="large" color="#7C3AED" />
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.profileTop}>
        <Avatar avatarId={profile.avatar_id} username={profile.username} size={88} />
        <View style={styles.nameRow}>
          <Text style={styles.username}>{profile.username ?? 'Unknown'}</Text>
          {profile.is_verified && <VerifiedBadge size={16} />}
        </View>
        {profile.role && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{profile.role.toUpperCase()}</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statBox}
          disabled={!canSeeLists}
          onPress={() => router.push(`/follow-list?id=${id}&type=followers`)}
        >
          <Text style={styles.statValue}>{canSeeLists ? followersCount : '—'}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statBox}
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
              {isFollowing ? 'Following' : 'Follow'}
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

      {!isOwnProfile && (
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} onPress={handleBlockToggle} disabled={actionLoading}>
            <View style={[styles.menuIconCircle, { backgroundColor: '#ff444422' }]}>
              <Ionicons name="ban" size={16} color="#ff4444" />
            </View>
            <Text style={styles.menuText}>{isBlocked ? 'Unblock User' : 'Block User'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push(`/report-user?target_user_id=${id}`)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: '#FFB80022' }]}>
              <Ionicons name="warning" size={16} color="#FFB800" />
            </View>
            <Text style={styles.menuText}>Report User</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  errorText: { color: '#fff', fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
  },
  profileTop: { alignItems: 'center', marginBottom: 24 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  username: { fontSize: 22, fontWeight: '900', color: '#fff' },
  roleBadge: {
    marginTop: 8, backgroundColor: '#7C3AED22', paddingHorizontal: 12,
    paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#7C3AED',
  },
  roleText: { color: '#7C3AED', fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginBottom: 6 },
  statBox: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: '#aaa', fontSize: 12, marginTop: 2 },
  privateHint: { color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 24 },
  actionBtn: {
    flex: 1, backgroundColor: '#7C3AED', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  actionBtnActive: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#7C3AED', shadowOpacity: 0 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionBtnTextActive: { color: '#7C3AED' },
  actionBtnOutline: {
    flex: 1, backgroundColor: '#1a1a1a', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a',
  },
  actionBtnOutlineText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  menu: { gap: 8 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#161616', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#262626',
  },
  menuIconCircle: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  menuText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
});
