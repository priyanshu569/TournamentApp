import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView, TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import VerifiedBadge from '@/components/VerifiedBadge';

export default function TournamentDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

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
        .select('status')
        .eq('tournament_id', id)
        .eq('player_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reg) {
        setIsRegistered(true);
        setIsConfirmed(reg.status === 'confirmed');
      }
    }

    const { data, error } = await supabase
      .from('tournaments')
      .select('*, host:public_profiles!host_id(username, is_verified)')
      .eq('id', id)
      .single();

    if (error) Alert.alert('Error', error.message);
    else {
      setTournament(data);
      setRoomCode(data.room_code ?? '');
      setRoomPassword(data.room_password ?? '');
    }
    setLoading(false);
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
    }
  };

  const handleStatusUpdate = async (s: string) => {
    const { error } = await supabase
      .from('tournaments')
      .update({ status: s })
      .eq('id', id);

    if (!error) {
      setTournament((prev: any) => ({ ...prev, status: s }));
    } else {
      Alert.alert('Error', error.message);
    }
  };

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

  const gameColor = getGameColor(tournament.game);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Game Tag */}
      <View style={[styles.gameTag, { backgroundColor: gameColor + '22' }]}>
        <Text style={[styles.gameTagText, { color: gameColor }]}>
          {tournament.game.toUpperCase()}
        </Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>{tournament.title}</Text>

      {/* Host Row */}
      <View style={styles.hostRow}>
        <Text style={styles.hostedBy}>Hosted by {tournament.host?.username}</Text>
        {tournament.host?.is_verified && <VerifiedBadge size={15} />}
      </View>

      {/* Status + Date Row */}
      <View style={styles.statusRow}>
        <View style={[styles.statusBadge, { borderColor: gameColor }]}>
          <Text style={[styles.statusText, { color: gameColor }]}>
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
        <View style={styles.alreadyRegistered}>
          <Text style={styles.alreadyRegisteredText}>
            {isConfirmed
              ? '✅ You are confirmed for this tournament!'
              : '⏳ Registration pending payment confirmation.'}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: gameColor }]}
          onPress={() => router.push(`/create-team?tournament_id=${tournament.id}&entry_fee=${tournament.entry_fee}`)}
        >
          <Text style={styles.actionButtonText}>Register Team →</Text>
        </TouchableOpacity>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, alignItems: 'center', borderWidth: 1,
    borderColor: '#2a2a2a', borderTopWidth: 3,
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
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: '#2a2a2a',
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
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  alreadyRegistered: {
    backgroundColor: '#0a1a0a', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#1a3a1a',
  },
  alreadyRegisteredText: { color: '#00D4AA', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});