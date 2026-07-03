import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type Row = {
  team_id: string;
  player_id: string;
  team_name: string;
  kills: number;
};

export default function LiveScoreboard() {
  const { tournament_id } = useLocalSearchParams();
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
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
      .select('team_id, player_id, teams(name)')
      .eq('tournament_id', tournament_id)
      .eq('status', 'confirmed');

    const { data: existing } = await supabase
      .from('match_results')
      .select('team_id, kills')
      .eq('tournament_id', tournament_id);

    const killsMap = new Map((existing ?? []).map((r) => [r.team_id, r.kills]));

    const built: Row[] = (regs ?? []).map((r: any) => ({
      team_id: r.team_id,
      player_id: r.player_id,
      team_name: r.teams?.name ?? 'Unknown Team',
      kills: killsMap.get(r.team_id) ?? 0,
    }));

    setRows(built);
    setLoading(false);
  }

  async function updateKills(row: Row, delta: number) {
    const newKills = Math.max(0, row.kills + delta);

    setRows((prev) =>
      prev.map((r) => (r.team_id === row.team_id ? { ...r, kills: newKills } : r))
    );
    setUpdatingId(row.team_id);

    const { error } = await supabase
      .from('match_results')
      .upsert(
        {
          tournament_id: tournament_id,
          team_id: row.team_id,
          player_id: row.player_id,
          kills: newKills,
        },
        { onConflict: 'tournament_id,team_id' }
      );

    setUpdatingId(null);

    if (error) {
      Alert.alert('Error', error.message);
      loadData();
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
      <Text style={styles.sub}>Tap +/- to update kill counts in real time</Text>

      <ScrollView contentContainerStyle={styles.list}>
        {rows.length === 0 ? (
          <Text style={styles.emptyText}>No confirmed teams yet.</Text>
        ) : (
          rows
            .slice()
            .sort((a, b) => b.kills - a.kills)
            .map((row) => (
              <View key={row.team_id} style={styles.row}>
                <Text style={styles.teamName}>{row.team_name}</Text>
                <View style={styles.controls}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => updateKills(row, -1)}
                    disabled={updatingId === row.team_id}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.killCount}>{row.kills}</Text>
                  <TouchableOpacity
                    style={[styles.stepBtn, styles.stepBtnPlus]}
                    onPress={() => updateKills(row, 1)}
                    disabled={updatingId === row.team_id}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
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
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#2a2a2a',
  },
  teamName: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center',
  },
  stepBtnPlus: { backgroundColor: '#7C3AED' },
  stepBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  killCount: { color: '#fff', fontSize: 18, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  finishBtn: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    marginHorizontal: 24, marginBottom: 24,
  },
  finishBtnText: { color: '#7C3AED', fontSize: 14, fontWeight: '700' },
});