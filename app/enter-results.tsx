import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView, TextInput
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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
  placement: string;
  benchedMemberId: string | null;
  kills: Record<string, string>;
};

export default function EnterResults() {
  const { tournament_id } = useLocalSearchParams();
  const [tournament, setTournament] = useState<any>(null);
  const [roster, setRoster] = useState<RosterTeam[]>([]);
  const [selectedMatch, setSelectedMatch] = useState(1);
  const [matchState, setMatchState] = useState<Record<string, MatchTeamState>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

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

    const { data: placements } = await supabase
      .from('match_results')
      .select('team_id, placement')
      .eq('tournament_id', tournament_id)
      .eq('match_number', matchNumber)
      .in('team_id', teamIds);

    const { data: kills } = await supabase
      .from('player_match_results')
      .select('team_member_id, team_id, kills')
      .eq('tournament_id', tournament_id)
      .eq('match_number', matchNumber)
      .in('team_id', teamIds);

    const placementMap = new Map((placements ?? []).map((r) => [r.team_id, r.placement]));
    const killsRows = kills ?? [];

    const nextState: Record<string, MatchTeamState> = {};

    for (const team of roster) {
      const playedIds = new Set(
        killsRows.filter((k) => k.team_id === team.team_id).map((k) => k.team_member_id)
      );

      let benchedMemberId: string | null = null;
      if (team.members.length > 4) {
        if (playedIds.size > 0) {
          const benched = team.members.find((m) => !playedIds.has(m.team_member_id));
          benchedMemberId = benched?.team_member_id ?? null;
        } else {
          // No results saved for this match yet — default to the sub sitting out.
          const sub = team.members.find((m) => m.is_substitute);
          benchedMemberId = sub?.team_member_id ?? null;
        }
      }

      const killsMap: Record<string, string> = {};
      for (const m of team.members) {
        const row = killsRows.find((k) => k.team_member_id === m.team_member_id);
        killsMap[m.team_member_id] = row ? String(row.kills) : '';
      }

      nextState[team.team_id] = {
        placement: placementMap.has(team.team_id) ? String(placementMap.get(team.team_id)) : '',
        benchedMemberId,
        kills: killsMap,
      };
    }

    setMatchState(nextState);
    setLoadingMatch(false);
    setDirty(false);
  }

  function updatePlacement(teamId: string, value: string) {
    setMatchState((prev) => ({
      ...prev,
      [teamId]: { ...prev[teamId], placement: value },
    }));
    setDirty(true);
  }

  function updateKills(teamId: string, memberId: string, value: string) {
    setMatchState((prev) => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        kills: { ...prev[teamId].kills, [memberId]: value },
      },
    }));
    setDirty(true);
  }

  function setBenched(teamId: string, memberId: string) {
    setMatchState((prev) => ({
      ...prev,
      [teamId]: { ...prev[teamId], benchedMemberId: memberId },
    }));
    setDirty(true);
  }

  function handleMatchTabPress(num: number) {
    if (num === selectedMatch) return;

    if (dirty) {
      Alert.alert(
        'Unsaved Changes',
        `You have unsaved changes for Match ${selectedMatch}. Switch anyway and lose them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard & Switch', style: 'destructive', onPress: () => setSelectedMatch(num) },
        ]
      );
    } else {
      setSelectedMatch(num);
    }
  }

  function teamTotalKills(team: RosterTeam) {
    const state = matchState[team.team_id];
    if (!state) return 0;
    return team.members.reduce((sum, m) => {
      if (m.team_member_id === state.benchedMemberId) return sum;
      return sum + (parseInt(state.kills[m.team_member_id], 10) || 0);
    }, 0);
  }

  async function handleSave() {
    const missingPlacement = roster.some((t) => !matchState[t.team_id]?.placement?.trim());
    if (missingPlacement) {
      Alert.alert('Missing Field', 'Please enter a placement for every team.');
      return;
    }

    setSaving(true);

    const playerPayload: any[] = [];
    const benchedDeletes: { team_member_id: string }[] = [];

    for (const team of roster) {
      const state = matchState[team.team_id];
      for (const m of team.members) {
        if (m.team_member_id === state.benchedMemberId) {
          benchedDeletes.push({ team_member_id: m.team_member_id });
          continue;
        }
        playerPayload.push({
          tournament_id: tournament_id,
          team_id: team.team_id,
          team_member_id: m.team_member_id,
          match_number: selectedMatch,
          kills: parseInt(state.kills[m.team_member_id], 10) || 0,
        });
      }
    }

    if (benchedDeletes.length > 0) {
      const { error: deleteError } = await supabase
        .from('player_match_results')
        .delete()
        .eq('tournament_id', tournament_id)
        .eq('match_number', selectedMatch)
        .in('team_member_id', benchedDeletes.map((b) => b.team_member_id));

      if (deleteError) {
        setSaving(false);
        Alert.alert('Error', deleteError.message);
        return;
      }
    }

    const { error: playerError } = await supabase
      .from('player_match_results')
      .upsert(playerPayload, { onConflict: 'tournament_id,team_member_id,match_number' });

    if (playerError) {
      setSaving(false);
      Alert.alert('Error', playerError.message);
      return;
    }

    const teamPayload = roster.map((t) => ({
      tournament_id: tournament_id,
      team_id: t.team_id,
      match_number: selectedMatch,
      placement: parseInt(matchState[t.team_id].placement, 10) || 0,
      kills: teamTotalKills(t),
    }));

    const { error: teamError } = await supabase
      .from('match_results')
      .upsert(teamPayload, { onConflict: 'tournament_id,team_id,match_number' });

    setSaving(false);

    if (teamError) {
      Alert.alert('Error', teamError.message);
    } else {
      setDirty(false);
      Alert.alert('Saved 🎉', `Results for Match ${selectedMatch} have been recorded.`);
    }
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Enter Results</Text>
      <Text style={styles.sub}>{tournament?.title}</Text>

      {matchCount > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matchRow}>
          {Array.from({ length: matchCount }, (_, i) => i + 1).map((num) => (
            <TouchableOpacity
              key={num}
              style={[styles.matchChip, selectedMatch === num && styles.matchChipActive]}
              onPress={() => handleMatchTabPress(num)}
            >
              <Text style={[styles.matchChipText, selectedMatch === num && styles.matchChipTextActive]}>
                Match {num}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {roster.length === 0 ? (
        <Text style={styles.emptyText}>No confirmed teams to enter results for.</Text>
      ) : loadingMatch || !matchState[roster[0].team_id] ? (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
      ) : (
        roster.map((team) => {
          const state = matchState[team.team_id];
          const hasSub = team.members.length > 4;

          return (
            <View key={team.team_id} style={styles.teamCard}>
              <View style={styles.teamHeader}>
                <Text style={styles.teamName}>{team.team_name}</Text>
                <View style={styles.totalKillsBadge}>
                  <Text style={styles.totalKillsText}>{teamTotalKills(team)} kills</Text>
                </View>
              </View>

              <View style={styles.placementGroup}>
                <Text style={styles.inputLabel}>Placement</Text>
                <TextInput
                  style={styles.placementInput}
                  placeholder="e.g. 1"
                  placeholderTextColor="#444"
                  keyboardType="number-pad"
                  value={state.placement}
                  onChangeText={(v) => updatePlacement(team.team_id, v)}
                />
              </View>

              <View style={styles.divider} />

              {hasSub && (
                <>
                  <Text style={styles.benchLabel}>Who sat out Match {selectedMatch}?</Text>
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
                </>
              )}

              {team.members.map((member) => {
                const benched = member.team_member_id === state.benchedMemberId;
                return (
                  <View key={member.team_member_id} style={[styles.memberRow, benched && styles.memberRowBenched]}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {member.in_game_name}{member.is_substitute ? ' (Sub)' : ''}
                      </Text>
                      <Text style={styles.memberUid}>UID: {member.player_uid}</Text>
                    </View>
                    {benched ? (
                      <Text style={styles.benchedTag}>Benched</Text>
                    ) : (
                      <View style={styles.killsGroup}>
                        <Text style={styles.inputLabel}>Kills</Text>
                        <TextInput
                          style={styles.killsInput}
                          placeholder="0"
                          placeholderTextColor="#444"
                          keyboardType="number-pad"
                          value={state.kills[member.team_member_id]}
                          onChangeText={(v) => updateKills(team.team_id, member.team_member_id, v)}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })
      )}

      {roster.length > 0 && (
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving || loadingMatch}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save Match {selectedMatch} Results</Text>
          }
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  heading: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 14, color: '#aaa', marginBottom: 16 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40 },
  matchRow: { marginBottom: 20 },
  matchChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', marginRight: 8,
  },
  matchChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  matchChipText: { color: '#aaa', fontSize: 13, fontWeight: '700' },
  matchChipTextActive: { color: '#fff' },
  teamCard: {
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a',
  },
  teamHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  teamName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  totalKillsBadge: {
    backgroundColor: '#7C3AED22', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#7C3AED',
  },
  totalKillsText: { color: '#7C3AED', fontSize: 12, fontWeight: '800' },
  placementGroup: { marginBottom: 12 },
  inputLabel: { color: '#aaa', fontSize: 12, marginBottom: 6, fontWeight: '600' },
  placementInput: {
    backgroundColor: '#0a0a0a', color: '#fff', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a', width: 100,
  },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginBottom: 12 },
  benchLabel: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  benchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  benchChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  benchChipActive: { backgroundColor: '#FF444422', borderColor: '#FF4444' },
  benchChipText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  benchChipTextActive: { color: '#FF4444', fontWeight: '700' },
  memberRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  memberRowBenched: { opacity: 0.5 },
  memberInfo: { flex: 1, marginRight: 12 },
  memberName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  memberUid: { color: '#555', fontSize: 11, marginTop: 1 },
  benchedTag: { color: '#FF4444', fontSize: 12, fontWeight: '700' },
  killsGroup: { width: 80 },
  killsInput: {
    backgroundColor: '#0a0a0a', color: '#fff', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a', textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: '#7C3AED', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
