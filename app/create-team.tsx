import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { notifyAndLog } from '@/lib/notifications';

type Member = {
  in_game_name: string;
  player_uid: string;
};

export default function CreateTeam() {
  const router = useRouter();
  const { tournament_id, entry_fee } = useLocalSearchParams();
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

    const { data: tournamentData } = await supabase
  .from('tournaments')
  .select('status')
  .eq('id', tournament_id)
  .single();

if (tournamentData?.status !== 'upcoming') {
  Alert.alert('Registration Closed', 'This tournament is no longer accepting registrations.');
  setLoading(false);
  return;
}

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

    const { data: reg, error: regError } = await supabase
      .from('registrations')
      .insert({
        tournament_id: tournament_id,
        team_id: team.id,
        player_id: user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (regError) {
      setLoading(false);
      Alert.alert('Error', regError.message);
      return;
    }

    const fee = Number(entry_fee) || 0;

    if (fee > 0) {
      setLoading(false);
      router.push(
        `/payment?amount=${fee}&tournament_id=${tournament_id}&team_id=${team.id}&registration_id=${reg?.id}`
      );
    } else {
      // Free tournament — confirm immediately
      const { error: confirmError } = await supabase
        .from('registrations')
        .update({ status: 'confirmed' })
        .eq('id', reg.id);

      if (confirmError) {
        console.log('Failed to auto-confirm free registration:', confirmError.message);
      }

      try {
        const { data: profile } = await supabase
          .from('Profiles')
          .select('push_token')
          .eq('id', user.id)
          .single();

        await notifyAndLog(
          user.id,
          profile?.push_token,
          '✅ Registration Confirmed',
          `${teamName} is confirmed for the tournament — no entry fee required!`,
          tournament_id as string
        );
      } catch (err) {
        console.log('Notify error:', err);
      }

      setLoading(false);
      Alert.alert('Registered! 🎉', `${teamName} is confirmed for the tournament!`, [
        { text: 'OK', onPress: () => router.push('/') }
      ]);
    }
  };

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
        <Text style={styles.heading}>Create Your Team</Text>
        <Text style={styles.sub}>Fill in team name and all 4 squad members.</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Team Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Shadow Wolves"
            placeholderTextColor="#444"
            value={teamName}
            onChangeText={setTeamName}
          />
        </View>

        <Text style={styles.sectionTitle}>SQUAD MEMBERS</Text>

        {members.map((member, index) => (
          <View key={index} style={styles.memberBox}>
            <View style={styles.memberHeader}>
              <View style={styles.memberIndex}>
                <Text style={styles.memberIndexText}>{index + 1}</Text>
              </View>
              <Text style={styles.memberTitle}>
                Player {index + 1} {index === 0 ? '— Captain' : ''}
              </Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="In-Game Name"
              placeholderTextColor="#444"
              value={member.in_game_name}
              onChangeText={(val) => updateMember(index, 'in_game_name', val)}
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="UID / Player ID"
              placeholderTextColor="#444"
              value={member.player_uid}
              onChangeText={(val) => updateMember(index, 'player_uid', val)}
              returnKeyType={index === 3 ? 'done' : 'next'}
            />
          </View>
        ))}

        {Number(entry_fee) > 0 && (
          <View style={styles.feeNote}>
            <Text style={styles.feeNoteText}>
              💰 Entry Fee: ₹{entry_fee} — You'll be redirected to payment after this step.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>
                {Number(entry_fee) > 0 ? `Proceed to Payment ₹${entry_fee} →` : 'Register Team 🚀'}
              </Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 80 },
  heading: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 14, color: '#aaa', marginBottom: 28 },
  sectionTitle: {
    color: '#555', fontSize: 11, fontWeight: '800',
    letterSpacing: 2, marginBottom: 12,
  },
  label: { color: '#aaa', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  fieldGroup: { marginBottom: 20 },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 10,
  },
  memberBox: {
    backgroundColor: '#111', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a',
  },
  memberHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  memberIndex: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#7C3AED', justifyContent: 'center',
    alignItems: 'center', marginRight: 10,
  },
  memberIndexText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  memberTitle: { color: '#7C3AED', fontSize: 13, fontWeight: '700' },
  feeNote: {
    backgroundColor: '#1a1a00', borderRadius: 10, padding: 14,
    marginBottom: 20, borderWidth: 1, borderColor: '#3a3a00',
  },
  feeNoteText: { color: '#FFB800', fontSize: 13, fontWeight: '600' },
  button: {
    backgroundColor: '#7C3AED', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});