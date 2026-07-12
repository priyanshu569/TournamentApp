import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type RosterMember = {
  team_member_id: string;
  in_game_name: string;
  player_uid: string;
  is_substitute: boolean;
};

type RosterTeam = {
  team_id: string;
  team_name: string;
  members: RosterMember[];
};

type MatchTeamState = {
  benchedMemberId: string | null;
  kills: Record<string, number>;
};

export default function LiveScoreboard() {
  const { tournament_id } = useLocalSearchParams();
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [roster, setRoster] = useState<RosterTeam[]>([]);
  const [selectedMatch, setSelectedMatch] = useState(1);
  const [matchState, setMatchState] = useState<Record<string, MatchTeamState>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => { loadRoster(); }, [tournament_id]);
  useEffect(() => {
    if (roster.length > 0) loadMatchData(selectedMatch);
  }, [selectedMatch, roster]);

  async function loadRoster() {
    const { data: t } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournament_id)
      .single();
    setTournament(t);

    const { data: regs } = await supabase
      .from('registrations')
      .select('team_id, teams(name)')
      .eq('tournament_id', tournament_id)
      .eq('status', 'confirmed');

    const teamIds = [...new Set((regs ?? []).map((r: any) => r.team_id))];

    if (teamIds.length === 0) {
      setRoster([]);
      setLoading(false);
      return;
    }

    const { data: members } = await supabase
      .from('team_members')
      .select('id, team_id, in_game_name, player_uid, is_substitute')
      .in('team_id', teamIds);

    const built: RosterTeam[] = (regs ?? []).map((r: any) => ({
      team_id: r.team_id,
      team_name: r.teams?.name ?? 'Unknown Team',
      members: (members ?? [])
        .filter((m: any) => m.team_id === r.team_id)
        .map((m: any) => ({
          team_member_id: m.id,
          in_game_name: m.in_game_name,
          player_uid: m.player_uid,
          is_substitute: !!m.is_substitute,
        }))
        .sort((a: RosterMember, b: RosterMember) => Number(a.is_substitute) - Number(b.is_substitute)),
    }));

    setRoster(built);
    setLoading(false);
  }

  async function loadMatchData(matchNumber: number) {
    setLoadingMatch(true);

    const teamIds = roster.map((t) => t.team_id);

    const { data: existing } = await supabase
      .from('player_match_results')
      .select('team_member_id, team_id, kills')
      .eq('tournament_id', tournament_id)
      .eq('match_number', matchNumber)
      .in('team_id', teamIds);

    const rows = existing ?? [];
    const nextState: Record<string, MatchTeamState> = {};

    for (const team of roster) {
      const playedIds = new Set(rows.filter((r) => r.team_id === team.team_id).map((r) => r.team_member_id));

      let benchedMemberId: string | null = null;
      if (team.members.length > 4) {
        if (playedIds.size > 0) {
          const benched = team.members.find((m) => !playedIds.has(m.team_member_id));
          benchedMemberId = benched?.team_member_id ?? null;
        } else {
          const sub = team.members.find((m) => m.is_substitute);
          benchedMemberId = sub?.team_member_id ?? null;
        }
      }

      const kills: Record<string, number> = {};
      for (const m of team.members) {
        const row = rows.find((r) => r.team_member_id === m.team_member_id);
        kills[m.team_member_id] = row?.kills ?? 0;
      }

      nextState[team.team_id] = { benchedMemberId, kills };
    }

    setMatchState(nextState);
    setLoadingMatch(false);
  }

  function teamTotalKills(team: RosterTeam) {
    const state = matchState[team.team_id];
    if (!state) return 0;
    return team.members.reduce((sum, m) => {
      if (m.team_member_id === state.benchedMemberId) return sum;
      return sum + (state.kills[m.team_member_id] ?? 0);
    }, 0);
  }

  async function setBenched(teamId: string, memberId: string) {
    const team = roster.find((t) => t.team_id === teamId);
    const prevBenched = matchState[teamId]?.benchedMemberId;
    if (!team || prevBenched === memberId) return;

    setMatchState((prev) => ({
      ...prev,
      [teamId]: { ...prev[teamId], benchedMemberId: memberId },
    }));

    // The newly benched member no longer counts toward this match.
    await supabase
      .from('player_match_results')
      .delete()
      .eq('tournament_id', tournament_id)
      .eq('match_number', selectedMatch)
      .eq('team_member_id', memberId);

    const total = team.members.reduce((sum, m) => {
      if (m.team_member_id === memberId) return sum;
      return sum + (matchState[teamId]?.kills[m.team_member_id] ?? 0);
    }, 0);

    await supabase
      .from('match_results')
      .upsert(
        { tournament_id: tournament_id, team_id: teamId, match_number: selectedMatch, kills: total },
        { onConflict: 'tournament_id,team_id,match_number' }
      );
  }

  async function updateMemberKills(teamId: string, member: RosterMember, delta: number) {
    const state = matchState[teamId];
    if (!state || member.team_member_id === state.benchedMemberId) return;

    const newKills = Math.max(0, (state.kills[member.team_member_id] ?? 0) + delta);

    setMatchState((prev) => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        kills: { ...prev[teamId].kills, [member.team_member_id]: newKills },
      },
    }));
    setUpdatingId(member.team_member_id);

    const { error: playerError } = await supabase
      .from('player_match_results')
      .upsert(
        {
          tournament_id: tournament_id,
          team_id: teamId,
          team_member_id: member.team_member_id,
          match_number: selectedMatch,
          kills: newKills,
        },
        { onConflict: 'tournament_id,team_member_id,match_number' }
      );

    if (playerError) {
      setUpdatingId(null);
      Alert.alert('Error', playerError.message);
      loadMatchData(selectedMatch);
      return;
    }

    const team = roster.find((t) => t.team_id === teamId);
    if (team) {
      const total = team.members.reduce((sum, m) => {
        if (m.team_member_id === state.benchedMemberId) return sum;
        const kills = m.team_member_id === member.team_member_id ? newKills : (state.kills[m.team_member_id] ?? 0);
        return sum + kills;
      }, 0);

      const { error: teamError } = await supabase
        .from('match_results')
        .upsert(
          { tournament_id: tournament_id, team_id: teamId, match_number: selectedMatch, kills: total },
          { onConflict: 'tournament_id,team_id,match_number' }
        );

      if (teamError) {
        Alert.alert('Error', teamError.message);
      }
    }

    setUpdatingId(null);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const matchCount = tournament?.match_count ?? 1;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <Text style={styles.heading}>{tournament?.title}</Text>
      <Text style={styles.sub}>Tap +/- to update each player's kills in real time</Text>

      {matchCount > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matchRow} contentContainerStyle={{ paddingHorizontal: 24 }}>
          {Array.from({ length: matchCount }, (_, i) => i + 1).map((num) => (
            <TouchableOpacity
              key={num}
              style={[styles.matchChip, selectedMatch === num && styles.matchChipActive]}
              onPress={() => setSelectedMatch(num)}
            >
              <Text style={[styles.matchChipText, selectedMatch === num && styles.matchChipTextActive]}>
                Match {num}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.list}>
        {roster.length === 0 ? (
          <Text style={styles.emptyText}>No confirmed teams yet.</Text>
        ) : loadingMatch || roster.some((t) => !matchState[t.team_id]) ? (
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
        ) : (
          roster
            .slice()
            .sort((a, b) => teamTotalKills(b) - teamTotalKills(a))
            .map((team) => {
              const state = matchState[team.team_id];
              const hasSub = team.members.length > 4;

              return (
                <View key={team.team_id} style={styles.teamCard}>
                  <View style={styles.teamHeader}>
                    <Text style={styles.teamName}>{team.team_name}</Text>
                    <View style={styles.totalKillsBadge}>
                      <Text style={styles.totalKillsText}>{teamTotalKills(team)}</Text>
                    </View>
                  </View>

                  {hasSub && (
                    <View style={styles.benchRow}>
                      {team.members.map((m) => (
                        <TouchableOpacity
                          key={m.team_member_id}
                          style={[
                            styles.benchChip,
                            state.benchedMemberId === m.team_member_id && styles.benchChipActive,
                          ]}
                          onPress={() => setBenched(team.team_id, m.team_member_id)}
                        >
                          <Text
                            style={[
                              styles.benchChipText,
                              state.benchedMemberId === m.team_member_id && styles.benchChipTextActive,
                            ]}
                          >
                            {m.in_game_name}{m.is_substitute ? ' (Sub)' : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {team.members.map((member) => {
                    const benched = member.team_member_id === state.benchedMemberId;
                    if (benched) {
                      return (
                        <View key={member.team_member_id} style={[styles.memberRow, styles.memberRowBenched]}>
                          <View style={styles.memberInfo}>
                            <Text style={styles.memberName}>
                              {member.in_game_name}{member.is_substitute ? ' (Sub)' : ''}
                            </Text>
                            <Text style={styles.memberUid}>UID: {member.player_uid}</Text>
                          </View>
                          <Text style={styles.benchedTag}>Benched</Text>
                        </View>
                      );
                    }

                    return (
                      <View key={member.team_member_id} style={styles.memberRow}>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>
                            {member.in_game_name}{member.is_substitute ? ' (Sub)' : ''}
                          </Text>
                          <Text style={styles.memberUid}>UID: {member.player_uid}</Text>
                        </View>
                        <View style={styles.controls}>
                          <TouchableOpacity
                            style={styles.stepBtn}
                            onPress={() => updateMemberKills(team.team_id, member, -1)}
                            disabled={updatingId === member.team_member_id}
                          >
                            <Text style={styles.stepBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.killCount}>{state.kills[member.team_member_id] ?? 0}</Text>
                          <TouchableOpacity
                            style={[styles.stepBtn, styles.stepBtnPlus]}
                            onPress={() => updateMemberKills(team.team_id, member, 1)}
                            disabled={updatingId === member.team_member_id}
                          >
                            <Text style={styles.stepBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.finishBtn}
        onPress={() => router.push(`/enter-results?tournament_id=${tournament_id}`)}
      >
        <Text style={styles.finishBtnText}>Finish → Enter Final Placements</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#3a0a0a', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20, gap: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff4444' },
  liveText: { color: '#ff4444', fontSize: 11, fontWeight: '800' },
  heading: { fontSize: 24, fontWeight: '900', color: '#fff', paddingHorizontal: 24, marginTop: 8 },
  sub: { fontSize: 13, color: '#aaa', paddingHorizontal: 24, marginTop: 4, marginBottom: 12 },
  matchRow: { marginBottom: 12, flexGrow: 0 },
  matchChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', marginRight: 8,
  },
  matchChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  matchChipText: { color: '#aaa', fontSize: 13, fontWeight: '700' },
  matchChipTextActive: { color: '#fff' },
  list: { paddingHorizontal: 24, paddingBottom: 16 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40 },
  teamCard: {
    backgroundColor: '#161616', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#262626',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  teamHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  teamName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  totalKillsBadge: {
    backgroundColor: '#7C3AED22', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#7C3AED',
  },
  totalKillsText: { color: '#7C3AED', fontSize: 13, fontWeight: '800' },
  benchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  benchChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  benchChipActive: { backgroundColor: '#FF444422', borderColor: '#FF4444' },
  benchChipText: { color: '#aaa', fontSize: 11, fontWeight: '600' },
  benchChipTextActive: { color: '#FF4444', fontWeight: '700' },
  memberRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#2a2a2a',
  },
  memberRowBenched: { opacity: 0.5 },
  memberInfo: { flex: 1, marginRight: 12 },
  memberName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  memberUid: { color: '#555', fontSize: 11, marginTop: 1 },
  benchedTag: { color: '#FF4444', fontSize: 12, fontWeight: '700' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center',
  },
  stepBtnPlus: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5, shadowRadius: 6, elevation: 4,
  },
  stepBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  killCount: { color: '#fff', fontSize: 16, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  finishBtn: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    marginHorizontal: 24, marginBottom: 24,
  },
  finishBtnText: { color: '#7C3AED', fontSize: 14, fontWeight: '700' },
});