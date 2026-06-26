import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

export default function EditTournament() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    rules: '',
    entry_fee: '',
    prize_pool: '',
    max_teams: '',
  });
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => { fetchTournament(); }, []);

  async function fetchTournament() {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    setForm({
      title: data.title ?? '',
      description: data.description ?? '',
      rules: data.rules ?? '',
      entry_fee: String(data.entry_fee ?? 0),
      prize_pool: String(data.prize_pool ?? 0),
      max_teams: String(data.max_teams ?? 12),
    });

    if (data.start_time) setStartTime(new Date(data.start_time));
    setLoading(false);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      Alert.alert('Missing', 'Title is required.');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('tournaments')
      .update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        rules: form.rules.trim() || null,
        entry_fee: parseFloat(form.entry_fee) || 0,
        prize_pool: parseFloat(form.prize_pool) || 0,
        max_teams: parseInt(form.max_teams) || 12,
        start_time: startTime ? startTime.toISOString() : null,
      })
      .eq('id', id);

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Updated! ✅', 'Tournament details saved.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }
  }

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Edit Tournament</Text>
        <Text style={styles.sub}>Update your tournament details.</Text>

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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Max Teams</Text>
          <TextInput
            style={styles.input}
            placeholder="12"
            placeholderTextColor="#444"
            keyboardType="numeric"
            value={form.max_teams}
            onChangeText={(val) => setForm(prev => ({ ...prev, max_teams: val }))}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description</Text>
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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Rules</Text>
          <TextInput
            style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
            placeholder={`1. No cheating\n2. Must join 10 mins before match`}
            placeholderTextColor="#444"
            multiline
            numberOfLines={5}
            value={form.rules}
            onChangeText={(val) => setForm(prev => ({ ...prev, rules: val }))}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Date & Time</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
            <Text style={styles.dateBtnIcon}>🗓</Text>
            <Text style={styles.dateBtnText}>
              {startTime ? formatDateTime(startTime) : 'Select Date & Time'}
            </Text>
          </TouchableOpacity>
        </View>

        <DateTimePickerModal
          isVisible={showPicker}
          mode="datetime"
          isDarkModeEnabled={false}
          onConfirm={(date) => { setStartTime(date); setShowPicker(false); }}
          onCancel={() => setShowPicker(false)}
        />

        <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Save Changes ✅</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 80 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  heading: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 14, color: '#aaa', marginBottom: 28 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 8, fontWeight: '600' },
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
  button: {
    backgroundColor: '#7C3AED', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});