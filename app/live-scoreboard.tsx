import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Member = {
  team_member_id: string;
  in_game_name: string;
  player_uid: string;
  kills: number;
};

type TeamGroup = {
  team_id: string;
  team_name: string;
  members: Member[];
};

export default function LiveScoreboard() {
  const { tournament_id } = useLocalSearchParams();
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<TeamGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

    const { data: existing } = await supabase
      .from('player_match_results')
      .select('team_member_id, kills')
      .eq('tournament_id', tournament_id);

    const killsMap = new Map((existing ?? []).map((r) => [r.team_member_id, r.kills]));

    const built: TeamGroup[] = (regs ?? []).map((r: any) => ({
      team_id: r.team_id,
      team_name: r.teams?.name ?? 'Unknown Team',
      members: (members ?? [])
        .filter((m: any) => m.team_id === r.team_id)
        .map((m: any) => ({
          team_member_id: m.id,
          in_game_name: m.in_game_name,
          player_uid: m.player_uid,
          kills: killsMap.get(m.id) ?? 0,
        })),
    }));

    setTeams(built);
    setLoading(false);
  }

  function teamTotalKills(team: TeamGroup) {
    return team.members.reduce((sum, m) => sum + m.kills, 0);
  }

  async function updateMemberKills(teamId: string, member: Member, delta: number) {
    const newKills = Math.max(0, member.kills + delta);

    setTeams((prev) =>
      prev.map((t) =>
        t.team_id === teamId
          ? {
              ...t,
              members: t.members.map((m) =>
                m.team_member_id === member.team_member_id ? { ...m, kills: newKills } : m
              ),
            }
          : t
      )
    );
    setUpdatingId(member.team_member_id);

    const { error: playerError } = await supabase
      .from('player_match_results')
      .upsert(
        {
          tournament_id: tournament_id,
          team_id: teamId,
          team_member_id: member.team_member_id,
          kills: newKills,
        },
        { onConflict: 'tournament_id,team_member_id' }
      );

    if (playerError) {
      setUpdatingId(null);
      Alert.alert('Error', playerError.message);
      loadData();
      return;
    }

    // Keep match_results.kills in sync as the team total
    const team = teams.find((t) => t.team_id === teamId);
    if (team) {
      const updatedMembers = team.members.map((m) =>
        m.team_member_id === member.team_member_id ? { ...m, kills: newKills } : m
      );
      const total = updatedMembers.reduce((sum, m) => sum + m.kills, 0);

      const { error: teamError } = await supabase
        .from('match_results')
        .upsert(
          { tournament_id: tournament_id, team_id: teamId, kills: total },
          { onConflict: 'tournament_id,team_id' }
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <Text style={styles.heading}>{tournament?.title}</Text>
      <Text style={styles.sub}>Tap +/- to update each player's kills in real time</Text>

      <ScrollView contentContainerStyle={styles.list}>
        {teams.length === 0 ? (
          <Text style={styles.emptyText}>No confirmed teams yet.</Text>
        ) : (
          teams
            .slice()
            .sort((a, b) => teamTotalKills(b) - teamTotalKills(a))
            .map((team) => (
              <View key={team.team_id} style={styles.teamCard}>
                <View style={styles.teamHeader}>
                  <Text style={styles.teamName}>{team.team_name}</Text>
                  <View style={styles.totalKillsBadge}>
                    <Text style={styles.totalKillsText}>{teamTotalKills(team)}</Text>
                  </View>
                </View>

                {team.members.map((member) => (
                  <View key={member.team_member_id} style={styles.memberRow}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.in_game_name}</Text>
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
                      <Text style={styles.killCount}>{member.kills}</Text>
                      <TouchableOpacity
                        style={[styles.stepBtn, styles.stepBtnPlus]}
                        onPress={() => updateMemberKills(team.team_id, member, 1)}
                        disabled={updatingId === member.team_member_id}
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))
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
  backText: { color: '#7C3AED', fontSize: 15, fontWeight: '600' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#3a0a0a', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20, gap: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff4444' },
  liveText: { color: '#ff4444', fontSize: 11, fontWeight: '800' },
  heading: { fontSize: 24, fontWeight: '900', color: '#fff', paddingHorizontal: 24, marginTop: 8 },
  sub: { fontSize: 13, color: '#aaa', paddingHorizontal: 24, marginTop: 4, marginBottom: 16 },
  list: { paddingHorizontal: 24, paddingBottom: 16 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40 },
  teamCard: {
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a',
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
  memberRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#2a2a2a',
  },
  memberInfo: { flex: 1, marginRight: 12 },
  memberName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  memberUid: { color: '#555', fontSize: 11, marginTop: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center',
  },
  stepBtnPlus: { backgroundColor: '#7C3AED' },
  stepBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  killCount: { color: '#fff', fontSize: 16, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  finishBtn: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    marginHorizontal: 24, marginBottom: 24,
  },
  finishBtnText: { color: '#7C3AED', fontSize: 14, fontWeight: '700' },
});
