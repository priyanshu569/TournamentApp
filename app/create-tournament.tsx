import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const GAMES = ['Free Fire', 'BGMI', 'COD Mobile', 'Valorant'];
const STATUSES = ['upcoming', 'ongoing', 'completed'];
const CATEGORIES: { value: 'tournament' | 'scrim'; label: string }[] = [
  { value: 'tournament', label: 'Tournament' },
  { value: 'scrim', label: 'Scrim' },
];
const LOBBY_TYPES: { value: 'mini' | 'mega'; label: string; defaultMatchCount: number }[] = [
  { value: 'mini', label: 'Mini Lobby', defaultMatchCount: 3 },
  { value: 'mega', label: 'Mega Lobby', defaultMatchCount: 5 },
];
const DEFAULT_PLACEMENT_POINTS = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const DEFAULT_KILL_POINT = 1;

export default function CreateTournament() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState('Free Fire');
  const [selectedStatus, setSelectedStatus] = useState('upcoming');
  const [category, setCategory] = useState<'tournament' | 'scrim'>('tournament');
  const [lobbyType, setLobbyType] = useState<'mini' | 'mega'>('mini');
  const [matchCount, setMatchCount] = useState('1');
  const [customizePoints, setCustomizePoints] = useState(false);
  const [placementPoints, setPlacementPoints] = useState<string[]>(
    DEFAULT_PLACEMENT_POINTS.map(String)
  );
  const [killPoint, setKillPoint] = useState(String(DEFAULT_KILL_POINT));
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [form, setForm] = useState({
    title: '',
    entry_fee: '',
    prize_pool: '',
    max_teams: '12',
    description: '',
    rules: '',
  });

  const selectCategory = (value: 'tournament' | 'scrim') => {
    setCategory(value);
    if (value === 'tournament') {
      setMatchCount('1');
    } else {
      const lobby = LOBBY_TYPES.find((l) => l.value === lobbyType) ?? LOBBY_TYPES[0];
      setMatchCount(String(lobby.defaultMatchCount));
    }
  };

  const selectLobbyType = (value: 'mini' | 'mega') => {
    setLobbyType(value);
    const lobby = LOBBY_TYPES.find((l) => l.value === value)!;
    setMatchCount(String(lobby.defaultMatchCount));
  };

  const updatePlacementPoint = (rankIndex: number, value: string) => {
    setPlacementPoints((prev) => {
      const next = [...prev];
      next[rankIndex] = value;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.title || !selectedGame || !form.max_teams) {
      Alert.alert('Missing Fields', 'Please fill in Title, Game, and Max Teams.');
      return;
    }

    const parsedMatchCount = parseInt(matchCount, 10);
    if (!parsedMatchCount || parsedMatchCount < 1) {
      Alert.alert('Missing Fields', 'Match count must be at least 1.');
      return;
    }

    const pointRules = {
      placement: placementPoints.map((p) => parseInt(p, 10) || 0),
      kill_point: parseFloat(killPoint) || 0,
    };

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Error', 'Not logged in.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('tournaments').insert({
      title: form.title,
      game: selectedGame,
      entry_fee: parseFloat(form.entry_fee) || 0,
      prize_pool: parseFloat(form.prize_pool) || 0,
      max_teams: parseInt(form.max_teams),
      status: selectedStatus,
      host_id: user?.id,
      start_time: startTime ? startTime.toISOString() : null,
      description: form.description || null,
      rules: form.rules || null,
      category: category,
      lobby_type: category === 'scrim' ? lobbyType : null,
      match_count: parsedMatchCount,
      point_rules: pointRules,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Tournament Created! 🎉', 'Your tournament is now live.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.heading}>Create Tournament</Text>
      <Text style={styles.sub}>Fill in the details to go live.</Text>

      {/* Game Selection */}
      <Text style={styles.label}>Select Game *</Text>
      <View style={styles.gameGrid}>
        {GAMES.map((game) => (
          <TouchableOpacity
            key={game}
            style={[styles.gameChip, selectedGame === game && styles.gameChipActive]}
            onPress={() => setSelectedGame(game)}
          >
            <Text style={[styles.gameChipText, selectedGame === game && styles.gameChipTextActive]}>
              {game}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category */}
      <Text style={styles.label}>Event Type *</Text>
      <View style={styles.statusRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.value}
            style={[styles.statusChip, category === c.value && styles.statusChipActive]}
            onPress={() => selectCategory(c.value)}
          >
            <Text style={[styles.statusChipText, category === c.value && styles.statusChipTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {category === 'scrim' && (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Lobby Type *</Text>
          <View style={styles.statusRow}>
            {LOBBY_TYPES.map((l) => (
              <TouchableOpacity
                key={l.value}
                style={[styles.statusChip, lobbyType === l.value && styles.statusChipActive]}
                onPress={() => selectLobbyType(l.value)}
              >
                <Text style={[styles.statusChipText, lobbyType === l.value && styles.statusChipTextActive]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Match Count */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Number of Matches *{category === 'scrim' ? ' (default set by lobby type, editable)' : ''}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="1"
          placeholderTextColor="#444"
          keyboardType="numeric"
          value={matchCount}
          onChangeText={setMatchCount}
        />
      </View>

      {/* Scoring */}
      <View style={styles.fieldGroup}>
        <View style={styles.scoringHeaderRow}>
          <Text style={styles.label}>Scoring</Text>
          <TouchableOpacity onPress={() => setCustomizePoints((v) => !v)}>
            <Text style={styles.customizeLink}>
              {customizePoints ? 'Use Default ↺' : '⚙ Customize Points'}
            </Text>
          </TouchableOpacity>
        </View>

        {!customizePoints ? (
          <Text style={styles.scoringDefaultText}>
            Default: #1=12 · #2=9 · #3=8 · #4=7 · #5=6 · #6=5 · #7=4 · #8=3 · #9=2 · #10=1 · 1 kill = 1 pt
          </Text>
        ) : (
          <>
            <View style={styles.pointsGrid}>
              {placementPoints.map((value, i) => (
                <View key={i} style={styles.pointBox}>
                  <Text style={styles.pointBoxLabel}>#{i + 1}</Text>
                  <TextInput
                    style={styles.pointBoxInput}
                    keyboardType="numeric"
                    value={value}
                    onChangeText={(v) => updatePlacementPoint(i, v)}
                  />
                </View>
              ))}
            </View>
            <View style={styles.killPointRow}>
              <Text style={styles.label}>Points per Kill</Text>
              <TextInput
                style={[styles.input, { width: 100 }]}
                keyboardType="numeric"
                value={killPoint}
                onChangeText={setKillPoint}
              />
            </View>
          </>
        )}
      </View>

      {/* Title */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Tournament Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Free Fire Sunday Cup"
          placeholderTextColor="#444"
          value={form.title}
          onChangeText={(val) => setForm(prev => ({ ...prev, title: val }))}
        />
      </View>

      {/* Entry Fee */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Entry Fee (₹)</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#444"
          keyboardType="numeric"
          value={form.entry_fee}
          onChangeText={(val) => setForm(prev => ({ ...prev, entry_fee: val }))}
        />
      </View>

      {/* Prize Pool */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Prize Pool (₹)</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor="#444"
          keyboardType="numeric"
          value={form.prize_pool}
          onChangeText={(val) => setForm(prev => ({ ...prev, prize_pool: val }))}
        />
      </View>

      {/* Max Teams */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Max Teams *</Text>
        <TextInput
          style={styles.input}
          placeholder="12"
          placeholderTextColor="#444"
          keyboardType="numeric"
          value={form.max_teams}
          onChangeText={(val) => setForm(prev => ({ ...prev, max_teams: val }))}
        />
      </View>

      {/* Description */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Tournament Description</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          placeholder="Brief description of the tournament..."
          placeholderTextColor="#444"
          multiline
          numberOfLines={4}
          value={form.description}
          onChangeText={(val) => setForm(prev => ({ ...prev, description: val }))}
        />
      </View>

      {/* Rules */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Tournament Rules</Text>
        <TextInput
          style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
          placeholder={`1. No cheating\n2. Must join 10 mins before match\n3. Results must be submitted as screenshots`}
          placeholderTextColor="#444"
          multiline
          numberOfLines={5}
          value={form.rules}
          onChangeText={(val) => setForm(prev => ({ ...prev, rules: val }))}
        />
      </View>

      {/* Date & Time */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Tournament Date & Time *</Text>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowPicker(true)}
        >
          <Text style={styles.dateBtnIcon}>🗓</Text>
          <Text style={styles.dateBtnText}>
            {startTime ? formatDateTime(startTime) : 'Select Date & Time'}
          </Text>
        </TouchableOpacity>
      </View>

      <DateTimePickerModal
        isVisible={showPicker}
        mode="datetime"
        minimumDate={new Date()}
        isDarkModeEnabled={false}
        onConfirm={(date) => {
          setStartTime(date);
          setShowPicker(false);
        }}
        onCancel={() => setShowPicker(false)}
      />

      {/* Status */}
      <Text style={styles.label}>Status</Text>
      <View style={styles.statusRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.statusChip, selectedStatus === s && styles.statusChipActive]}
            onPress={() => setSelectedStatus(s)}
          >
            <Text style={[styles.statusChipText, selectedStatus === s && styles.statusChipTextActive]}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Create Tournament 🚀</Text>
        }
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
  heading: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 14, color: '#aaa', marginBottom: 28 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 8, fontWeight: '600', letterSpacing: 0.5 },
  gameGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  gameChip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, backgroundColor: '#1a1a1a',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  gameChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  gameChipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  gameChipTextActive: { color: '#fff' },
  fieldGroup: { marginBottom: 18 },
  scoringHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  customizeLink: { color: '#7C3AED', fontSize: 12, fontWeight: '700' },
  scoringDefaultText: {
    color: '#666', fontSize: 12, lineHeight: 18,
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  pointsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  pointBox: {
    width: '18%', backgroundColor: '#1a1a1a', borderRadius: 8,
    borderWidth: 1, borderColor: '#2a2a2a', padding: 8, alignItems: 'center',
  },
  pointBoxLabel: { color: '#7C3AED', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  pointBoxInput: {
    color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center',
    width: '100%', paddingVertical: 2,
  },
  killPointRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  dateBtn: {
    backgroundColor: '#1a1a1a', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: '#7C3AED',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  dateBtnIcon: { fontSize: 18 },
  dateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statusChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#1a1a1a', borderWidth: 1,
    borderColor: '#2a2a2a', alignItems: 'center',
  },
  statusChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  statusChipText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  statusChipTextActive: { color: '#fff' },
  button: {
    backgroundColor: '#7C3AED', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});