import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView, RefreshControl, TextInput, Share
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import VerifiedBadge from '@/components/VerifiedBadge';
import { notifyAndLog } from '@/lib/notifications';
import { isEffectivelyHost } from '@/lib/effectiveRole';
import * as Clipboard from 'expo-clipboard';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';
import { TOURNAMENT_BANNER_RATIO } from '@/constants/banner';

export default function TournamentDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchData(); }, [id]);

  // Realtime subscription — keeps the Results section live for everyone viewing this tournament
  useEffect(() => {
    const channel = supabase
      .channel(`match_results_${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_results', filter: `tournament_id=eq.${id}` },
        () => {
          fetchMatchResults();
          fetchStandings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function fetchMatchResults() {
    const { data: results } = await supabase
      .from('match_results')
      .select('*, teams(name)')
      .eq('tournament_id', id)
      .order('placement', { ascending: true })
      .order('kills', { ascending: false });

    if (results) setMatchResults(results);
  }

  async function fetchStandings() {
    const { data, error } = await supabase.rpc('get_tournament_standings', {
      target_tournament_id: id,
    });

    if (error) {
      console.log('Standings error:', error.message);
      return;
    }
    if (data) setStandings(data);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  async function fetchData() {
    const { data: userData } = await supabase.auth.getUser();

    if (userData.user) {
      const { data: profile } = await supabase
        .from('Profiles')
        .select('role, browsing_mode, is_admin')
        .eq('id', userData.user.id)
        .single();
      // role state holds the *effective* role for this viewer (a host
      // browsing as a player, or an admin previewing as a host, sees
      // that role's controls here) -- it's only used for local UI
      // gating on this screen, never shown to other users, so this
      // doesn't affect how anyone else sees them.
      if (profile) setRole(isEffectivelyHost(profile) ? 'host' : 'player');

      const { data: reg } = await supabase
        .from('registrations')
        .select('id, status')
        .eq('tournament_id', id)
        .eq('player_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reg) {
        setIsRegistered(true);
        setIsConfirmed(reg.status === 'confirmed');
        setRegistrationId(reg.id);
      }
    }

    const { data, error } = await supabase
      .from('tournaments')
      .select('*, host:public_profiles!host_id(id, display_name, is_verified)')
      .eq('id', id)
      .single();

    if (error) Alert.alert('Error', error.message);
    else {
      setTournament(data);
      setRoomCode(data.room_code ?? '');
      setRoomPassword(data.room_password ?? '');
    }

    await Promise.all([fetchMatchResults(), fetchStandings()]);
    setLoading(false);
  }

  async function notifyConfirmedPlayers(title: string, body: string, category: string = 'tournament_updates') {
    try {
      const { data, error } = await supabase.rpc('get_confirmed_players', {
        target_tournament_id: id,
        p_category: category,
      });

      if (error) {
        console.log('Failed to fetch confirmed players:', error.message);
        return;
      }

      const players = data ?? [];
      await Promise.all(
        players.map((p: any) =>
          notifyAndLog(p.user_id, p.push_token, title, body, id as string)
        )
      );
    } catch (err) {
      console.log('Notify error:', err);
    }
  }

  const handleSaveRoomCode = async () => {
    if (!roomCode.trim()) {
      Alert.alert('Missing', 'Please enter a room code.');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('tournaments')
      .update({ room_code: roomCode.trim(), room_password: roomPassword.trim() })
      .eq('id', id);

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setTournament((prev: any) => ({ ...prev, room_code: roomCode, room_password: roomPassword }));
      setShowRoomForm(false);
      Alert.alert('Published! 🔑', 'Room code is now visible to confirmed players.');

      notifyConfirmedPlayers(
        '🔑 Room Code Published',
        `${tournament?.title ?? 'Your tournament'} room code is live — check it now!`,
        'room_codes'
      );
    }
  };

  const handleStatusUpdate = (s: string) => {
    if (s === 'ongoing' && !tournament.room_code) {
      Alert.alert(
        'No Room Code Published',
        "Players won't know where to join without a room code. Publish it before starting?",
        [
          { text: 'Publish Room Code', onPress: () => setShowRoomForm(true) },
          { text: 'Start Anyway', style: 'destructive', onPress: () => applyStatusUpdate(s) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    applyStatusUpdate(s);
  };

  async function applyStatusUpdate(s: string) {
    const { error } = await supabase
      .from('tournaments')
      .update({ status: s })
      .eq('id', id);

    if (!error) {
      setTournament((prev: any) => ({ ...prev, status: s }));

      const statusMessages: Record<string, string> = {
        ongoing: `🔥 ${tournament?.title ?? 'Your tournament'} has started — get ready!`,
        completed: `🏁 ${tournament?.title ?? 'Your tournament'} has ended. Thanks for playing!`,
      };

      if (statusMessages[s]) {
        notifyConfirmedPlayers('Tournament Update', statusMessages[s], s === 'completed' ? 'results' : 'tournament_updates');
      }
    } else {
      Alert.alert('Error', error.message);
    }
  }

  function confirmCancelRegistration() {
    Alert.alert(
      'Cancel Registration?',
      'Your team and squad details will be removed, and your slot will be freed.',
      [
        { text: 'Keep Registration', style: 'cancel' },
        { text: 'Cancel Registration', style: 'destructive', onPress: handleCancelRegistration },
      ]
    );
  }

  async function handleCancelRegistration() {
    if (!registrationId) return;

    setCancelling(true);
    const { error } = await supabase.rpc('cancel_registration', {
      p_registration_id: registrationId,
    });
    setCancelling(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setIsRegistered(false);
      setIsConfirmed(false);
      setRegistrationId(null);
      Alert.alert('Cancelled', 'Your registration has been cancelled.');
    }
  }

  const getGameColor = (game: string) => {
    const g = game?.toLowerCase() ?? '';
    if (g.includes('free fire') || g.includes('freefire')) return '#FF6B35';
    if (g.includes('bgmi')) return '#FFB800';
    if (g.includes('cod')) return '#00D4AA';
    if (g.includes('valorant')) return '#FF4655';
    return '#7C3AED';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const getDeepLink = () => `tournamentapp://tournament-details?id=${tournament.id}`;

  const handleShare = async () => {
    try {
      const message =
        `🏆 ${tournament.title}\n\n` +
        `🎮 ${tournament.game}\n` +
        `💰 Prize Pool: ₹${tournament.prize_pool}\n` +
        `🎯 Entry Fee: ₹${tournament.entry_fee}\n\n` +
        `Join on Fragify 👉 ${getDeepLink()}`;

      await Share.share({ message, title: tournament.title });
    } catch (err) {
      console.log('Share error:', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(getDeepLink());
      Alert.alert('Copied! 🔗', 'Tournament link copied to clipboard.');
    } catch (err) {
      Alert.alert('Error', 'Failed to copy link.');
    }
  };

  function getPlayerStatusMessage() {
    if (!isConfirmed) {
      return { icon: '⏳', text: 'Registration pending payment confirmation.', color: colors.warning };
    }
    if (tournament.status === 'completed') {
      return { icon: '🏁', text: 'Tournament has ended — check the final standings above!', color: colors.textSecondary };
    }
    if (tournament.status === 'ongoing') {
      return { icon: '🔴', text: 'Tournament is live right now — good luck out there!', color: colors.warning };
    }
    if (tournament.room_code) {
      return { icon: '✅', text: 'Confirmed! Your room code is ready below.', color: colors.success };
    }
    return { icon: '✅', text: "Confirmed! We'll notify you when the room code is published.", color: colors.success };
  }

  function medal(placement: number | null) {
    if (!placement) return '🔴';
    if (placement === 1) return '🥇';
    if (placement === 2) return '🥈';
    if (placement === 3) return '🥉';
    return `#${placement}`;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Tournament not found.</Text>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    if (status === 'upcoming') return colors.success;
    if (status === 'ongoing') return colors.warning;
    if (status === 'completed') return colors.error;
    return colors.textTertiary;
  };

  const gameColor = getGameColor(tournament.game);
  const hasLiveResults = matchResults.some((r) => !r.placement);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
    >

      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleCopyLink}>
            <Ionicons name="link" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
            <Ionicons name="share-social" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Banner Image */}
      {tournament.banner_url && (
        <Image source={{ uri: tournament.banner_url }} style={styles.banner} contentFit="cover" />
      )}

      {/* Game Tag */}
      <View style={styles.topRow}>
        <View style={[styles.gameTag, { backgroundColor: gameColor + '22', marginBottom: 0 }]}>
          <Text style={[styles.gameTagText, { color: gameColor }]}>
            {(tournament.game ?? '').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>{tournament.title}</Text>

      {/* Host Row */}
      <TouchableOpacity
        style={styles.hostRow}
        onPress={() => tournament.host?.id && router.push(`/user-profile?id=${tournament.host.id}`)}
      >
        <Text style={styles.hostedBy}>Hosted by {tournament.host?.display_name}</Text>
        {tournament.host?.is_verified && <VerifiedBadge size={15} />}
      </TouchableOpacity>

      {/* Status + Date Row */}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { borderColor: getStatusColor(tournament.status) }]}>
          <Text style={[styles.statusText, { color: getStatusColor(tournament.status) }]}>
            {tournament.status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.dateText}>🗓 {formatDate(tournament.start_time)}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { borderTopColor: gameColor }]}>
          <Text style={styles.statValue}>₹{tournament.entry_fee}</Text>
          <Text style={styles.statLabel}>Entry Fee</Text>
        </View>
        <View style={[styles.statBox, { borderTopColor: gameColor }]}>
          <Text style={styles.statValue}>₹{tournament.prize_pool}</Text>
          <Text style={styles.statLabel}>Prize Pool</Text>
        </View>
        <View style={[styles.statBox, { borderTopColor: gameColor }]}>
          <Text style={styles.statValue}>{tournament.max_teams}</Text>
          <Text style={styles.statLabel}>Max Teams</Text>
        </View>
      </View>

      {/* Live / Completed banner — visible to host and player alike */}
      {tournament.status === 'ongoing' && (
        <View style={styles.liveBanner}>
          <View style={styles.livePulseDot} />
          <Text style={styles.liveBannerText}>This tournament is LIVE right now!</Text>
        </View>
      )}
      {tournament.status === 'completed' && (
        <View style={styles.completedBanner}>
          <Ionicons name="checkmark-done-circle" size={18} color={colors.textTertiary} />
          <Text style={styles.completedBannerText}>This tournament has ended</Text>
        </View>
      )}

      <View style={styles.divider} />
      {/* Description */}
      {(tournament.description || role === 'host') && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ABOUT</Text>
            {role === 'host' && (
              <TouchableOpacity onPress={() => router.push(`/edit-tournament?id=${tournament.id}`)}>
                <Text style={styles.editBtn}>Edit ✏️</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.descriptionText}>
            {tournament.description ?? 'No description added yet.'}
          </Text>
        </View>
      )}

      {/* Rules */}
      {(tournament.rules || role === 'host') && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RULES</Text>
            {role === 'host' && (
              <TouchableOpacity onPress={() => router.push(`/edit-tournament?id=${tournament.id}`)}>
                <Text style={styles.editBtn}>Edit ✏️</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.rulesBox}>
            <Text style={styles.rulesText}>
              {tournament.rules ?? 'No rules added yet.'}
            </Text>
          </View>
        </View>
      )}

      {/* Results — cumulative standings across every match entered so far */}
      {(standings.length > 0 || role === 'host') && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.resultsTitleRow}>
              <Text style={styles.sectionTitle}>
                STANDINGS{tournament.match_count > 1 ? ` (${tournament.match_count} MATCHES)` : ''}
              </Text>
              {hasLiveResults && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              )}
            </View>

            {role === 'host' && (
              <View style={styles.resultsActions}>
                {tournament.status === 'ongoing' && (
                  <TouchableOpacity onPress={() => router.push(`/live-scoreboard?tournament_id=${tournament.id}`)}>
                    <Text style={styles.liveScoreBtn}>🔴 Update Live</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => router.push(`/enter-results?tournament_id=${tournament.id}`)}>
                  <Text style={styles.editBtn}>
                    {standings.length > 0 ? 'Edit ✏️' : 'Enter Results 📊'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {standings.length === 0 ? (
            <Text style={styles.descriptionText}>No results entered yet.</Text>
          ) : (
            <View style={styles.resultsBox}>
              {standings.map((s, i) => (
                <View key={s.team_id} style={styles.resultRow}>
                  <Text style={styles.resultMedal} numberOfLines={1}>{medal(i + 1)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTeam}>{s.team_name ?? 'Unknown Team'}</Text>
                    <Text style={styles.resultSub}>
                      {s.matches_played} match{s.matches_played === 1 ? '' : 'es'} played · {s.total_kills} kills
                    </Text>
                  </View>
                  <Text style={styles.resultPoints}>{s.total_points} pts</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Room Code Section — Host */}
      {role === 'host' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ROOM CODE</Text>

          {tournament.room_code ? (
            <View style={styles.roomCodeBox}>
              <View style={styles.roomRow}>
                <Text style={styles.roomLabel}>Room ID</Text>
                <Text style={styles.roomValue}>{tournament.room_code}</Text>
              </View>
              {tournament.room_password ? (
                <View style={styles.roomRow}>
                  <Text style={styles.roomLabel}>Password</Text>
                  <Text style={styles.roomValue}>{tournament.room_password}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={styles.editRoomBtn} onPress={() => setShowRoomForm(true)}>
                <Text style={styles.editRoomBtnText}>Update Room Code</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: gameColor }]}
                onPress={() => setShowRoomForm(true)}
              >
                <Text style={styles.actionButtonText}>🔑 Publish Room Code</Text>
              </TouchableOpacity>
              {tournament.status === 'upcoming' && (
                <Text style={styles.statusHint}>Publish your room code before marking this Ongoing</Text>
              )}
            </>
          )}

          {showRoomForm && (
            <View style={styles.roomForm}>
              <TextInput
                style={styles.input}
                placeholder="Room ID / Code"
                placeholderTextColor={colors.textDisabled}
                value={roomCode}
                onChangeText={setRoomCode}
              />
              <TextInput
                style={styles.input}
                placeholder="Password (optional)"
                placeholderTextColor={colors.textDisabled}
                value={roomPassword}
                onChangeText={setRoomPassword}
              />
              <View style={styles.roomFormBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRoomForm(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: gameColor }]}
                  onPress={handleSaveRoomCode}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveBtnText}>Publish</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Status Update — Host */}
      {role === 'host' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>UPDATE STATUS</Text>
          <View style={styles.statusChipRow}>
            {['upcoming', 'ongoing', 'completed'].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusChip,
                  tournament.status === s && { backgroundColor: gameColor, borderColor: gameColor }
                ]}
                onPress={() => handleStatusUpdate(s)}
              >
                <Text style={[
                  styles.statusChipText,
                  tournament.status === s && { color: '#fff' }
                ]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Room Code — Confirmed Player */}
      {role === 'player' && isConfirmed && tournament.room_code && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ROOM CODE</Text>
          <View style={[styles.roomCodeBox, { borderColor: gameColor }]}>
            <View style={styles.roomRow}>
              <Text style={styles.roomLabel}>Room ID</Text>
              <Text style={[styles.roomValue, { color: gameColor }]}>{tournament.room_code}</Text>
            </View>
            {tournament.room_password ? (
              <View style={styles.roomRow}>
                <Text style={styles.roomLabel}>Password</Text>
                <Text style={[styles.roomValue, { color: gameColor }]}>{tournament.room_password}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* Waiting for room code */}
      {role === 'player' && isConfirmed && !tournament.room_code && (
        <View style={styles.waitingBox}>
          <Text style={styles.waitingText}>⏳ Room code not published yet. Check back before match time!</Text>
        </View>
      )}

      <View style={styles.divider} />

      {/* Action Button */}
      {role === 'host' ? (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: gameColor }]}
          onPress={() => router.push(`/registrations?tournament_id=${tournament.id}`)}
        >
          <Text style={styles.actionButtonText}>View Registrations →</Text>
        </TouchableOpacity>
      ) : isRegistered ? (
        <>
          {(() => {
            const msg = getPlayerStatusMessage();
            return (
              <View style={[styles.alreadyRegistered, { borderColor: msg.color + '55' }]}>
                <Text style={[styles.alreadyRegisteredText, { color: msg.color }]}>
                  {msg.icon} {msg.text}
                </Text>
              </View>
            );
          })()}

          {!isConfirmed && (
            <TouchableOpacity
              style={styles.cancelRegBtn}
              onPress={confirmCancelRegistration}
              disabled={cancelling}
            >
              {cancelling
                ? <ActivityIndicator color={colors.error} size="small" />
                : <Text style={styles.cancelRegBtnText}>Cancel Registration</Text>
              }
            </TouchableOpacity>
          )}
        </>
      ) : tournament.status === 'upcoming' ? (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: gameColor }]}
          onPress={() => router.push(`/create-team?tournament_id=${tournament.id}&entry_fee=${tournament.entry_fee}`)}
        >
          <Text style={styles.actionButtonText}>Register Team →</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.actionButton, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}>
          <Text style={{ color: colors.textFaint, fontSize: 15, fontWeight: '700' }}>
            {tournament.status === 'ongoing' ? '🔒 Tournament In Progress' : '🏁 Tournament Ended'}
          </Text>
        </View>
      )}

    </ScrollView>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
};

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    headerBar: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginTop: 4, marginBottom: 16,
    },
    banner: {
      // aspectRatio, not a fixed height, so this shows exactly the region the
      // host framed in the crop tool -- same reasoning as index.tsx/events.tsx.
      width: '100%', aspectRatio: TOURNAMENT_BANNER_RATIO,
      borderRadius: 14, marginBottom: 16,
      ...cardShadow,
    },
    topRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 16,
    },
    shareRow: { flexDirection: 'row', gap: 8 },
    iconBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },

    descriptionText: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
    rulesBox: {
      backgroundColor: colors.surface, borderRadius: 14,
      padding: 16, borderWidth: 1, borderColor: colors.borderMuted,
      ...cardShadow,
    },
    rulesText: { color: colors.textSecondary, fontSize: 14, lineHeight: 24 },

    resultsBox: {
      backgroundColor: colors.surface, borderRadius: 14,
      padding: 16, borderWidth: 1, borderColor: colors.borderMuted,
      ...cardShadow,
    },
    resultRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    resultMedal: { minWidth: 32, fontSize: 14, fontWeight: '800', color: colors.textPrimary },
    resultTeam: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    resultKills: { color: colors.accent, fontSize: 13, fontWeight: '700' },
    resultSub: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
    resultPoints: { color: colors.warning, fontSize: 14, fontWeight: '800' },

    resultsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    liveBadge: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: '#3a0a0a', paddingHorizontal: 8,
      paddingVertical: 2, borderRadius: 20, gap: 4,
    },
    liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.error },
    liveBadgeText: { color: colors.error, fontSize: 10, fontWeight: '800' },
    resultsActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    liveScoreBtn: { color: colors.error, fontSize: 13, fontWeight: '700' },

    sectionHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 12,
    },
    editBtn: { color: colors.accent, fontSize: 13, fontWeight: '600' },

    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    errorText: { color: colors.textPrimary, fontSize: 16 },
    gameTag: {
      alignSelf: 'flex-start', paddingHorizontal: 12,
      paddingVertical: 6, borderRadius: 8, marginBottom: 16,
    },
    gameTagText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    title: { fontSize: 30, fontWeight: '900', color: colors.textPrimary, marginBottom: 6, lineHeight: 36 },
    hostRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    hostedBy: { fontSize: 13, color: colors.textTertiary, fontWeight: '600' },
    statusRow: {
      flexDirection: 'row', alignItems: 'center',
      gap: 12, marginBottom: 24,
    },
    statusBadge: {
      paddingHorizontal: 12, paddingVertical: 4,
      borderRadius: 20, borderWidth: 1,
    },
    statusText: { fontSize: 12, fontWeight: '700' },
    dateText: { color: colors.textSecondary, fontSize: 13 },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statBox: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 14,
      padding: 16, alignItems: 'center', borderWidth: 1,
      borderColor: colors.borderMuted, borderTopWidth: 3,
      ...cardShadow,
    },
    statValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    statLabel: { fontSize: 11, color: colors.textSecondary },
    liveBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: '#3a2a00', borderWidth: 1, borderColor: colors.warning,
      borderRadius: 14, padding: 16, marginBottom: 24,
    },
    livePulseDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.warning },
    liveBannerText: { color: colors.warning, fontSize: 14, fontWeight: '700' },
    completedBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 14, padding: 16, marginBottom: 24,
    },
    completedBannerText: { color: colors.textTertiary, fontSize: 14, fontWeight: '700' },
    divider: { height: 1, backgroundColor: colors.surfaceAlt, marginBottom: 24 },
    section: { marginBottom: 24 },
    sectionTitle: {
      color: colors.textFaint, fontSize: 11, fontWeight: '800',
      letterSpacing: 2, marginBottom: 12,
    },
    roomCodeBox: {
      backgroundColor: colors.surface, borderRadius: 14,
      padding: 16, borderWidth: 1, borderColor: colors.borderMuted,
      ...cardShadow,
    },
    roomRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 8,
    },
    roomLabel: { color: colors.textSecondary, fontSize: 13 },
    roomValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
    editRoomBtn: { marginTop: 8 },
    editRoomBtnText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
    roomForm: { marginTop: 16 },
    input: {
      backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
      borderWidth: 1, borderColor: colors.border, marginBottom: 10,
    },
    roomFormBtns: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
      flex: 1, paddingVertical: 14, borderRadius: 12,
      alignItems: 'center', backgroundColor: colors.surfaceAlt,
      borderWidth: 1, borderColor: colors.border,
    },
    cancelBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    saveBtn: {
      flex: 1, paddingVertical: 14,
      borderRadius: 12, alignItems: 'center', 
    },
    saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    statusChipRow: { flexDirection: 'row', gap: 8 },
    statusChip: {
      flex: 1, paddingVertical: 10, borderRadius: 10,
      backgroundColor: colors.surfaceAlt, borderWidth: 1,
      borderColor: colors.border, alignItems: 'center',
    },
    statusChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    statusHint: { color: colors.warning, fontSize: 12, marginTop: 10, fontWeight: '600' },
    waitingBox: {
      backgroundColor: '#1a1a00', borderRadius: 12, padding: 16,
      borderWidth: 1, borderColor: '#3a3a00', marginBottom: 24,
    },
    waitingText: { color: colors.warning, fontSize: 13, fontWeight: '600' },
    actionButton: {
      paddingVertical: 16, borderRadius: 14, alignItems: 'center',
      ...cardShadow,
    },
    actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    alreadyRegistered: {
      backgroundColor: '#0a1a0a', borderRadius: 12, padding: 16,
      borderWidth: 1, borderColor: '#1a3a1a',
    },
    alreadyRegisteredText: { color: colors.success, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    cancelRegBtn: {
      marginTop: 12, paddingVertical: 14, borderRadius: 12,
      alignItems: 'center', backgroundColor: '#1a0a0a',
      borderWidth: 1, borderColor: '#3a1a1a',
    },
    cancelRegBtnText: { color: colors.error, fontSize: 14, fontWeight: '700' },
  });
}
