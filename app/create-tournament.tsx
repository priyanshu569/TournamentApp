import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function CreateTournament() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    game: '',
    entry_fee: '',
    prize_pool: '',
    max_teams: '',
  });

  const handleSubmit = async () => {
  if (!form.title || !form.game || !form.max_teams) {
    Alert.alert('Missing Fields', 'Please fill in Title, Game, and Max Teams.');
    return;
  }

  setLoading(true);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (!user) {
    Alert.alert('Auth Error', 'Not logged in: ' + authError?.message);
    setLoading(false);
    return;
  }

  console.log('User ID:', user.id);

  const { error } = await supabase.from('tournaments').insert({
    title: form.title,
    game: form.game,
    entry_fee: parseFloat(form.entry_fee) || 0,
    prize_pool: parseFloat(form.prize_pool) || 0,
    max_teams: parseInt(form.max_teams),
    status: 'upcoming',
    host_id: user.id,
  });

  setLoading(false);

  if (error) {
    Alert.alert('Insert Error', error.message + ' | Code: ' + error.code);
  } else {
    Alert.alert('Success', 'Tournament created!', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  }
};

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Create Tournament</Text>

      {[
        { label: 'Tournament Title *', key: 'title', placeholder: 'e.g. Free Fire Sunday Cup' },
        { label: 'Game *', key: 'game', placeholder: 'e.g. Free Fire, BGMI' },
        { label: 'Entry Fee (₹)', key: 'entry_fee', placeholder: '0', keyboard: 'numeric' },
        { label: 'Prize Pool (₹)', key: 'prize_pool', placeholder: '0', keyboard: 'numeric' },
        { label: 'Max Teams *', key: 'max_teams', placeholder: 'e.g. 16', keyboard: 'numeric' },
      ].map(({ label, key, placeholder, keyboard }) => (
        <View key={key} style={styles.fieldGroup}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#555"
            keyboardType={(keyboard as any) || 'default'}
            value={form[key as keyof typeof form]}
            onChangeText={(val) => setForm(prev => ({ ...prev, [key]: val }))}
          />
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Tournament</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingBottom: 48 },
  heading: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 28 },
  fieldGroup: { marginBottom: 18 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  button: {
    backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});