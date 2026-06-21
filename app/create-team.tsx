import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';

type Member = {
  in_game_name: string;
  player_uid: string;
};

export default function CreateTeam() {
  const router = useRouter();
  const { tournament_id } = useLocalSearchParams();
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([
    { in_game_name: '', player_uid: '' },
    { in_game_name: '', player_uid: '' },
    { in_game_name: '', player_uid: '' },
    { in_game_name: '', player_uid: '' },
  ]);

  const updateMember = (index: number, field: keyof Member, value: string) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const handleCreate = async () => {
    if (!teamName.trim()) {
      Alert.alert('Missing Field', 'Please enter a team name.');
      return;
    }

    for (let i = 0; i < members.length; i++) {
      if (!members[i].in_game_name.trim() || !members[i].player_uid.trim()) {
        Alert.alert('Missing Field', `Please fill in all details for Player ${i + 1}.`);
        return;
      }
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

    // Step 2: Insert team members
    const { error: membersError } = await supabase
      .from('team_members')
      .insert(
        members.map((m) => ({
          team_id: team.id,
          in_game_name: m.in_game_name.trim(),
          player_uid: m.player_uid.trim(),
        }))
      );

    if (membersError) {
      Alert.alert('Error', membersError.message);
      setLoading(false);
      return;
    }

    // Step 3: Create registration
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Create Your Team</Text>
      <Text style={styles.sub}>Fill in team name and all 4 squad members.</Text>

      <Text style={styles.label}>Team Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Shadow Wolves"
        placeholderTextColor="#555"
        value={teamName}
        onChangeText={setTeamName}
      />

      {members.map((member, index) => (
        <View key={index} style={styles.memberBox}>
          <Text style={styles.memberTitle}>Player {index + 1} {index === 0 ? '(Captain)' : ''}</Text>
          <TextInput
            style={styles.input}
            placeholder="In-Game Name"
            placeholderTextColor="#555"
            value={member.in_game_name}
            onChangeText={(val) => updateMember(index, 'in_game_name', val)}
          />
          <TextInput
            style={styles.input}
            placeholder="UID / Player ID"
            placeholderTextColor="#555"
            value={member.player_uid}
            onChangeText={(val) => updateMember(index, 'player_uid', val)}
          />
        </View>
      ))}

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Register Team</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingBottom: 48 },
  heading: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8 },
  sub: { fontSize: 14, color: '#aaa', marginBottom: 28 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 12,
  },
  memberBox: {
    borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12,
    padding: 16, marginBottom: 16, backgroundColor: '#111',
  },
  memberTitle: { color: '#7C3AED', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  button: {
    backgroundColor: '#7C3AED', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});