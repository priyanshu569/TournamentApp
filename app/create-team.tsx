import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function CreateTeam() {
  const router = useRouter();
  const { tournament_id } = useLocalSearchParams();
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!teamName.trim()) {
      Alert.alert('Missing Field', 'Please enter a team name.');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Error', 'Not logged in.');
      setLoading(false);
      return;
    }

    // Step 1: Create the team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: teamName.trim(),
        captain_id: user.id,
        tournament_id: tournament_id,
      })
      .select()
      .single();

    if (teamError) {
      Alert.alert('Error', teamError.message);
      setLoading(false);
      return;
    }

    // Step 2: Create the registration
    const { error: regError } = await supabase
      .from('registrations')
      .insert({
        tournament_id: tournament_id,
        team_id: team.id,
        player_id: user.id,
        status: 'pending',
      });

    setLoading(false);

    if (regError) {
      Alert.alert('Error', regError.message);
    } else {
      Alert.alert('Registered! 🎉', `${teamName} is registered for the tournament!`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Create Your Team</Text>
      <Text style={styles.sub}>You'll be the captain of this team.</Text>

      <Text style={styles.label}>Team Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Shadow Wolves"
        placeholderTextColor="#555"
        value={teamName}
        onChangeText={setTeamName}
      />

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Create Team</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24, paddingTop: 60 },
  heading: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8 },
  sub: { fontSize: 14, color: '#aaa', marginBottom: 32 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 24,
  },
  button: {
    backgroundColor: '#7C3AED', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});