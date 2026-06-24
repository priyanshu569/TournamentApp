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

export default function CreateTournament() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState('Free Fire');
  const [selectedStatus, setSelectedStatus] = useState('upcoming');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
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
      start_time: startTime ? startTime.toISOString() : null,
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