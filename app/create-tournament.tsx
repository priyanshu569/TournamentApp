import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';

const GAMES = ['Free Fire', 'BGMI', 'COD Mobile', 'Valorant'];
const STATUSES = ['upcoming', 'ongoing', 'completed'];

export default function CreateTournament() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState('Free Fire');
  const [selectedStatus, setSelectedStatus] = useState('upcoming');
  const [startTime, setStartTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [form, setForm] = useState({
    title: '',
    entry_fee: '',
    prize_pool: '',
    max_teams: '12',
  });

  const handleSubmit = async () => {
    if (!form.title || !selectedGame || !form.max_teams) {
      Alert.alert('Missing Fields', 'Please fill in Title, Game, and Max Teams.');
      return;
    }

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
      start_time: startTime.toISOString(),
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

      {/* Date & Time */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Tournament Date & Time *</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={[styles.dateBtn, { flex: 1 }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateBtnLabel}>📅 Date</Text>
            <Text style={styles.dateBtnValue}>
              {startTime.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateBtn, { flex: 1 }]}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.dateBtnLabel}>⏰ Time</Text>
            <Text style={styles.dateBtnValue}>
              {startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.datePreview}>
          <Text style={styles.datePreviewText}>🗓 {formatDateTime(startTime)}</Text>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={startTime}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              const updated = new Date(startTime);
              updated.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
              setStartTime(updated);
            }
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (date) {
              const updated = new Date(startTime);
              updated.setHours(date.getHours(), date.getMinutes());
              setStartTime(updated);
            }
          }}
        />
      )}

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
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dateBtn: {
    backgroundColor: '#1a1a1a', borderRadius: 10,
    padding: 14, borderWidth: 1, borderColor: '#2a2a2a',
  },
  dateBtnLabel: { color: '#555', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  dateBtnValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  datePreview: {
    backgroundColor: '#7C3AED22', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#7C3AED44',
  },
  datePreviewText: { color: '#7C3AED', fontSize: 13, fontWeight: '600' },
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