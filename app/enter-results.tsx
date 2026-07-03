import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView, TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type MemberRow = {
  team_member_id: string;
  in_game_name: string;
  player_uid: string;
  kills: string;
};

type TeamRow = {
  team_id: string;
  team_name: string;
  placement: string;
  members: MemberRow[];
};

export default function EnterResults() {
  const { tournament_id } = useLocalSearchParams();
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [tournament_id]);

  async function loadData() {
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
      setTeams([]);
      setLoading(false);
      return;
    }

    const { data: members } = await supabase
      .from('team_members')
      .select('id, team_id, in_game_name, player_uid')
      .in('team_id', teamIds);

    const { data: existingPlacements } = await supabase
      .from('match_results')
      .select('team_id, placement')
      .eq('tournament_id', tournament_id);

    const { data: existingKills } = await supabase
      .from('player_match_results')
      .select('team_member_id, kills')
      .eq('tournament_id', tournament_id);

    const placementMap = new Map((existingPlacements ?? []).map((r) => [r.team_id, r.placement]));
    const killsMap = new Map((existingKills ?? []).map((r) => [r.team_member_id, r.kills]));

    const built: TeamRow[] = (regs ?? []).map((r: any) => {
      const teamMembers = (members ?? [])
        .filter((m: any) => m.team_id === r.team_id)
        .map((m: any) => ({
          team_member_id: m.id,
          in_game_name: m.in_game_name,
          player_uid: m.player_uid,
          kills: killsMap.has(m.id) ? String(killsMap.get(m.id)) : '',
        }));

      return {
        team_id: r.team_id,
        team_name: r.teams?.name ?? 'Unknown Team',
        placement: placementMap.has(r.team_id) ? String(placementMap.get(r.team_id)) : '',
        members: teamMembers,
      };
    });

    setTeams(built);
    setLoading(false);
  }

  function updatePlacement(teamId: string, value: string) {
    setTeams((prev) =>
      prev.map((t) => (t.team_id === teamId ? { ...t, placement: value } : t))
    );
  }

  function updateMemberKills(teamId: string, memberId: string, value: string) {
    setTeams((prev) =>
      prev.map((t) =>
        t.team_id === teamId
          ? {
              ...t,
              members: t.members.map((m) =>
                m.team_member_id === memberId ? { ...m, kills: value } : m
              ),
            }
          : t
      )
    );
  }

  function teamTotalKills(team: TeamRow) {
    return team.members.reduce((sum, m) => sum + (parseInt(m.kills, 10) || 0), 0);
  }

  async function handleSave() {
    const missingPlacement = teams.some((t) => !t.placement.trim());
    if (missingPlacement) {
      Alert.alert('Missing Field', 'Please enter a placement for every team.');
      return;
    }

    setSaving(true);

    const playerPayload = teams.flatMap((t) =>
      t.members.map((m) => ({
        tournament_id: tournament_id,
        team_id: t.team_id,
        team_member_id: m.team_member_id,
        kills: parseInt(m.kills, 10) || 0,
      }))
    );

    const teamPayload = teams.map((t) => ({
      tournament_id: tournament_id,
      team_id: t.team_id,
      placement: parseInt(t.placement, 10) || 0,
      kills: teamTotalKills(t),
    }));

    const { error: playerError } = await supabase
      .from('player_match_results')
      .upsert(playerPayload, { onConflict: 'tournament_id,team_member_id' });

    if (playerError) {
      setSaving(false);
      Alert.alert('Error', playerError.message);
      return;
    }

    const { error: teamError } = await supabase
      .from('match_results')
      .upsert(teamPayload, { onConflict: 'tournament_id,team_id' });

    setSaving(false);

    if (teamError) {
      Alert.alert('Error', teamError.message);
    } else {
      Alert.alert('Saved 🎉', 'Results have been recorded.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Enter Results</Text>
      <Text style={styles.sub}>{tournament?.title}</Text>

      {teams.length === 0 ? (
        <Text style={styles.emptyText}>No confirmed teams to enter results for.</Text>
      ) : (
        teams.map((team) => (
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
                value={team.placement}
                onChangeText={(v) => updatePlacement(team.team_id, v)}
              />
            </View>

            <View style={styles.divider} />

            {team.members.map((member) => (
              <View key={member.team_member_id} style={styles.memberRow}>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.in_game_name}</Text>
                  <Text style={styles.memberUid}>UID: {member.player_uid}</Text>
                </View>
                <View style={styles.killsGroup}>
                  <Text style={styles.inputLabel}>Kills</Text>
                  <TextInput
                    style={styles.killsInput}
                    placeholder="0"
                    placeholderTextColor="#444"
                    keyboardType="number-pad"
                    value={member.kills}
                    onChangeText={(v) => updateMemberKills(team.team_id, member.team_member_id, v)}
                  />
                </View>
              </View>
            ))}
          </View>
        ))
      )}

      {teams.length > 0 && (
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save Results</Text>
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
  sub: { fontSize: 14, color: '#aaa', marginBottom: 24 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40 },
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
  memberRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  memberInfo: { flex: 1, marginRight: 12 },
  memberName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  memberUid: { color: '#555', fontSize: 11, marginTop: 1 },
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
