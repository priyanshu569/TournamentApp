import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  FlatList, RefreshControl, TouchableOpacity
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function Registrations() {
  const { tournament_id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tournament, setTournament] = useState<any>(null);

  useEffect(() => {
  fetchRegistrations();
}, [tournament_id]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchRegistrations();
    setRefreshing(false);
  }

  async function fetchRegistrations() {
    const { data: t } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournament_id)
      .single();

    if (t) setTournament(t);

    const { data, error } = await supabase
      .from('registrations')
      .select('id, status, player_id, teams(name, team_members(in_game_name, player_uid))')
      .eq('tournament_id', tournament_id)
      .order('created_at', { ascending: false });

    if (error) console.log('Registration error:', error.message);
    if (data) setRegistrations(data);
    setLoading(false);
  }

  const getGameColor = (game: string) => {
    const g = game?.toLowerCase() ?? '';
    if (g.includes('free fire') || g.includes('freefire')) return '#FF6B35';
    if (g.includes('bgmi')) return '#FFB800';
    if (g.includes('cod')) return '#00D4AA';
    if (g.includes('valorant')) return '#FF4655';
    return '#7C3AED';
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const gameColor = getGameColor(tournament?.game ?? '');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Tournament Info */}
      <View style={styles.tournamentInfo}>
        <View style={[styles.gameTag, { backgroundColor: gameColor + '22' }]}>
          <Text style={[styles.gameTagText, { color: gameColor }]}>
            {tournament?.game?.toUpperCase() ?? ''}
          </Text>
        </View>
        <Text style={styles.tournamentTitle}>{tournament?.title ?? 'Registrations'}</Text>
        <Text style={styles.regCount}>
          {registrations.length} / {tournament?.max_teams} teams registered
        </Text>

        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${Math.min((registrations.length / (tournament?.max_teams || 1)) * 100, 100)}%` as any,
            backgroundColor: gameColor,
          }]} />
        </View>
      </View>

      {/* Registrations List */}
      <FlatList
        data={registrations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No teams registered yet.</Text>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.card, { borderLeftColor: gameColor, borderLeftWidth: 4 }]}>
            <View style={styles.cardHeader}>
              <View style={styles.teamNameRow}>
                <View style={styles.teamNumber}>
                  <Text style={styles.teamNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.teamName}>
                  {item.teams?.name ?? 'Unknown Team'}
                </Text>
              </View>
              <View style={[
                styles.badge,
                item.status === 'confirmed' ? styles.badgeConfirmed : styles.badgePending
              ]}>
                <Text style={styles.badgeText}>{(item.status ?? 'pending').toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {item.teams?.team_members?.map((member: any, i: number) => (
              <View key={i} style={styles.memberRow}>
                <View style={[styles.memberIndex, { backgroundColor: gameColor }]}>
                  <Text style={styles.memberIndexText}>{i + 1}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.in_game_name}</Text>
                  <Text style={styles.memberUid}>UID: {member.player_uid}</Text>
                </View>
                {i === 0 && (
                  <TouchableOpacity
                    style={styles.captainBadge}
                    onPress={() => item.player_id && router.push(`/user-profile?id=${item.player_id}`)}
                  >
                    <Text style={styles.captainText}>CAPTAIN</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      />
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 8 },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start',
    },
    tournamentInfo: { paddingHorizontal: 24, paddingBottom: 16 },
    gameTag: {
      alignSelf: 'flex-start', paddingHorizontal: 10,
      paddingVertical: 4, borderRadius: 6, marginBottom: 8,
    },
    gameTagText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    tournamentTitle: { fontSize: 22, fontWeight: '900', color: colors.textPrimary, marginBottom: 4 },
    regCount: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
    progressBar: {
      height: 4, backgroundColor: colors.surfaceAlt,
      borderRadius: 2, overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 2 },
    listContent: { padding: 24, paddingTop: 8 },
    emptyText: { color: colors.textFaint, textAlign: 'center', marginTop: 40 },
    card: {
      backgroundColor: colors.surface, borderRadius: 14,
      padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    cardHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 12,
    },
    teamNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    teamNumber: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: colors.border, justifyContent: 'center',
      alignItems: 'center', marginRight: 10,
    },
    teamNumberText: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
    teamName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flex: 1 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    badgePending: { backgroundColor: '#3a2a00' },
    badgeConfirmed: { backgroundColor: '#0a3a0a' },
    badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    divider: { height: 1, backgroundColor: colors.border, marginBottom: 12 },
    memberRow: {
      flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    },
    memberIndex: {
      width: 22, height: 22, borderRadius: 11,
      justifyContent: 'center', alignItems: 'center', marginRight: 10,
    },
    memberIndexText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    memberInfo: { flex: 1 },
    memberName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    memberUid: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
    captainBadge: {
      backgroundColor: colors.accentMutedStrong, paddingHorizontal: 8,
      paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: colors.accent,
    },
    captainText: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  });
}