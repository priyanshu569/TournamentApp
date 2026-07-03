import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, ScrollView, TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

type RowData = {
  team_id: string;
  player_id: string;
  team_name: string;
  placement: string;
  kills: string;
};

export default function EnterResults() {
  const { tournament_id } = useLocalSearchParams();
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [rows, setRows] = useState<RowData[]>([]);
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
      .select('team_id, player_id, teams(name)')
      .eq('tournament_id', tournament_id)
      .eq('status', 'confirmed');

    const { data: existing } = await supabase
      .from('match_results')
      .select('team_id, placement, kills')
      .eq('tournament_id', tournament_id);

    const existingMap = new Map(
      (existing ?? []).map((r) => [r.team_id, r])
    );

    const built: RowData[] = (regs ?? []).map((r: any) => {
      const prev = existingMap.get(r.team_id);
      return {
        team_id: r.team_id,
        player_id: r.player_id,
        team_name: r.teams?.name ?? 'Unknown Team',
        placement: prev ? String(prev.placement) : '',
        kills: prev ? String(prev.kills) : '',
      };
    });

    setRows(built);
    setLoading(false);
  }

  function updateRow(teamId: string, field: 'placement' | 'kills', value: string) {
    setRows((prev) =>
      prev.map((r) => (r.team_id === teamId ? { ...r, [field]: value } : r))
    );
  }

  async function handleSave() {
    const incomplete = rows.some((r) => !r.placement.trim());
    if (incomplete) {
      Alert.alert('Missing Field', 'Please enter a placement for every team.');
      return;
    }

    setSaving(true);

    const payload = rows.map((r) => ({
      tournament_id: tournament_id,
      team_id: r.team_id,
      player_id: r.player_id,
      placement: parseInt(r.placement, 10) || 0,
      kills: parseInt(r.kills, 10) || 0,
    }));

    const { error } = await supabase
      .from('match_results')
      .upsert(payload, { onConflict: 'tournament_id,team_id' });

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
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

      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No confirmed teams to enter results for.</Text>
      ) : (
        rows.map((row) => (
          <View key={row.team_id} style={styles.row}>
            <Text style={styles.teamName}>{row.team_name}</Text>
            <View style={styles.inputsRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Placement</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 1"
                  placeholderTextColor="#444"
                  keyboardType="number-pad"
                  value={row.placement}
                  onChangeText={(v) => updateRow(row.team_id, 'placement', v)}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Kills</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 12"
                  placeholderTextColor="#444"
                  keyboardType="number-pad"
                  value={row.kills}
                  onChangeText={(v) => updateRow(row.team_id, 'kills', v)}
                />
              </View>
            </View>
          </View>
        ))
      )}

      {rows.length > 0 && (
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
  row: {
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a',
  },
  teamName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  inputsRow: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { color: '#aaa', fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#0a0a0a', color: '#fff', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  saveBtn: {
    backgroundColor: '#7C3AED', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});