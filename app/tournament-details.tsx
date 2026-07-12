import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView, TextInput, Share
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import VerifiedBadge from '@/components/VerifiedBadge';
import { notifyAndLog } from '@/lib/notifications';
import * as Clipboard from 'expo-clipboard';

export default function TournamentDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
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

  async function fetchData() {
    const { data: userData } = await supabase.auth.getUser();

    if (userData.user) {
      const { data: profile } = await supabase
        .from('Profiles')
        .select('role')
        .eq('id', userData.user.id)
        .single();
      if (profile) setRole(profile.role);

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
      .select('*, host:public_profiles!host_id(id, username, is_verified)')
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

  async function notifyConfirmedPlayers(title: string, body: string) {
    try {
      const { data, error } = await supabase.rpc('get_confirmed_players', {
        target_tournament_id: id,
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
        `${tournament?.title ?? 'Your tournament'} room code is live — check it now!`
      );
    }
  };

  const handleStatusUpdate = async (s: string) => {
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
        notifyConfirmedPlayers('Tournament Update', statusMessages[s]);
      }
    } else {
      Alert.alert('Error', error.message);
    }
  };

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
        <ActivityIndicator size="large" color="#7C3AED" />
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
    if (status === 'upcoming') return '#00D4AA';
    if (status === 'ongoing') return '#FFB800';
    if (status === 'completed') return '#FF4444';
    return '#888';
  };

  const gameColor = getGameColor(tournament.game);
  const hasLiveResults = matchResults.some((r) => !r.placement);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleCopyLink}>
            <Ionicons name="link" size={16} color="#aaa" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
            <Ionicons name="share-social" size={16} color="#aaa" />
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
        <Text style={styles.hostedBy}>Hosted by {tournament.host?.username}</Text>
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
                  <Text style={styles.resultMedal}>{medal(i + 1)}</Text>
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
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: gameColor }]}
              onPress={() => setShowRoomForm(true)}
            >
              <Text style={styles.actionButtonText}>🔑 Publish Room Code</Text>
            </TouchableOpacity>
          )}

          {showRoomForm && (
            <View style={styles.roomForm}>
              <TextInput
                style={styles.input}
                placeholder="Room ID / Code"
                placeholderTextColor="#444"
                value={roomCode}
                onChangeText={setRoomCode}
              />
              <TextInput
                style={styles.input}
                placeholder="Password (optional)"
                placeholderTextColor="#444"
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
          <View style={styles.alreadyRegistered}>
            <Text style={styles.alreadyRegisteredText}>
              {isConfirmed
                ? '✅ You are confirmed for this tournament!'
                : '⏳ Registration pending payment confirmation.'}
            </Text>
          </View>

          {!isConfirmed && (
            <TouchableOpacity
              style={styles.cancelRegBtn}
              onPress={confirmCancelRegistration}
              disabled={cancelling}
            >
              {cancelling
                ? <ActivityIndicator color="#ff4444" size="small" />
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
        <View style={[styles.actionButton, { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' }]}>
          <Text style={{ color: '#555', fontSize: 15, fontWeight: '700' }}>
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

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 4, marginBottom: 16,
  },
  banner: {
    width: '100%', height: 180, borderRadius: 14, marginBottom: 16,
    ...cardShadow,
  },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  shareRow: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    justifyContent: 'center', alignItems: 'center',
  },

  descriptionText: { color: '#ccc', fontSize: 14, lineHeight: 22 },
  rulesBox: {
    backgroundColor: '#161616', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#262626',
    ...cardShadow,
  },
  rulesText: { color: '#ccc', fontSize: 14, lineHeight: 24 },

  resultsBox: {
    backgroundColor: '#161616', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#262626',
    ...cardShadow,
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  resultMedal: { width: 32, fontSize: 14, fontWeight: '800', color: '#fff' },
  resultTeam: { color: '#fff', fontSize: 14, fontWeight: '600' },
  resultKills: { color: '#7C3AED', fontSize: 13, fontWeight: '700' },
  resultSub: { color: '#555', fontSize: 11, marginTop: 2 },
  resultPoints: { color: '#FFB800', fontSize: 14, fontWeight: '800' },

  resultsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#3a0a0a', paddingHorizontal: 8,
    paddingVertical: 2, borderRadius: 20, gap: 4,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#ff4444' },
  liveBadgeText: { color: '#ff4444', fontSize: 10, fontWeight: '800' },
  resultsActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  liveScoreBtn: { color: '#ff4444', fontSize: 13, fontWeight: '700' },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  editBtn: { color: '#7C3AED', fontSize: 13, fontWeight: '600' },

  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  errorText: { color: '#fff', fontSize: 16 },
  gameTag: {
    alignSelf: 'flex-start', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 8, marginBottom: 16,
  },
  gameTagText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 30, fontWeight: '900', color: '#fff', marginBottom: 6, lineHeight: 36 },
  hostRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  hostedBy: { fontSize: 13, color: '#888', fontWeight: '600' },
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: 24,
  },
  statusBadge: {
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  dateText: { color: '#aaa', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statBox: {
    flex: 1, backgroundColor: '#161616', borderRadius: 14,
    padding: 16, alignItems: 'center', borderWidth: 1,
    borderColor: '#262626', borderTopWidth: 3,
    ...cardShadow,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#aaa' },
  divider: { height: 1, backgroundColor: '#1a1a1a', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: '#555', fontSize: 11, fontWeight: '800',
    letterSpacing: 2, marginBottom: 12,
  },
  roomCodeBox: {
    backgroundColor: '#161616', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#262626',
    ...cardShadow,
  },
  roomRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  roomLabel: { color: '#aaa', fontSize: 13 },
  roomValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  editRoomBtn: { marginTop: 8 },
  editRoomBtnText: { color: '#7C3AED', fontSize: 13, fontWeight: '600' },
  roomForm: { marginTop: 16 },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 10,
  },
  roomFormBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', backgroundColor: '#1a1a1a',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  cancelBtnText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  saveBtn: {
    flex: 1, paddingVertical: 14,
    borderRadius: 12, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  statusChipRow: { flexDirection: 'row', gap: 8 },
  statusChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#1a1a1a', borderWidth: 1,
    borderColor: '#2a2a2a', alignItems: 'center',
  },
  statusChipText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  waitingBox: {
    backgroundColor: '#1a1a00', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#3a3a00', marginBottom: 24,
  },
  waitingText: { color: '#FFB800', fontSize: 13, fontWeight: '600' },
  actionButton: {
    paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    ...cardShadow,
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  alreadyRegistered: {
    backgroundColor: '#0a1a0a', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#1a3a1a',
  },
  alreadyRegisteredText: { color: '#00D4AA', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  cancelRegBtn: {
    marginTop: 12, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', backgroundColor: '#1a0a0a',
    borderWidth: 1, borderColor: '#3a1a1a',
  },
  cancelRegBtnText: { color: '#ff4444', fontSize: 14, fontWeight: '700' },
});
