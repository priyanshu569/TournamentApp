import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { notifyAndLog } from '@/lib/notifications';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

type Member = {
  in_game_name: string;
  player_uid: string;
};

export default function CreateTeam() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { tournament_id, entry_fee } = useLocalSearchParams();
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([
    { in_game_name: '', player_uid: '' },
    { in_game_name: '', player_uid: '' },
    { in_game_name: '', player_uid: '' },
    { in_game_name: '', player_uid: '' },
  ]);
  const [substitute, setSubstitute] = useState<Member>({ in_game_name: '', player_uid: '' });

  const updateMember = (index: number, field: keyof Member, value: string) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const updateSubstitute = (field: keyof Member, value: string) => {
    setSubstitute((prev) => ({ ...prev, [field]: value }));
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

    const subName = substitute.in_game_name.trim();
    const subUid = substitute.player_uid.trim();
    if ((subName && !subUid) || (!subName && subUid)) {
      Alert.alert('Missing Field', 'Please fill in both fields for the substitute, or leave both blank.');
      return;
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
  .select('status, max_teams')
  .eq('id', tournament_id)
  .single();

if (tournamentData?.status !== 'upcoming') {
  Alert.alert('Registration Closed', 'This tournament is no longer accepting registrations.');
  setLoading(false);
  return;
}

const { count: registeredCount } = await supabase
  .from('registrations')
  .select('id', { count: 'exact', head: true })
  .eq('tournament_id', tournament_id);

if (tournamentData?.max_teams && (registeredCount ?? 0) >= tournamentData.max_teams) {
  Alert.alert('Tournament Full', 'All slots for this tournament have been filled.');
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

    const memberRows = members.map((m, index) => ({
      team_id: team.id,
      in_game_name: m.in_game_name.trim(),
      player_uid: m.player_uid.trim(),
      is_substitute: false,
      is_captain: index === 0,
    }));

    if (subName && subUid) {
      memberRows.push({
        team_id: team.id,
        in_game_name: subName,
        player_uid: subUid,
        is_substitute: true,
        is_captain: false,
      });
    }

    const { error: membersError } = await supabase
      .from('team_members')
      .insert(memberRows);

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

    try {
      await supabase.rpc('create_team_conversation', { p_team_id: team.id });
    } catch (err) {
      console.log('Team conversation creation error:', err);
    }

    const fee = Number(entry_fee) || 0;

    if (fee > 0) {
      setLoading(false);
      router.push(
        `/payment?amount=${fee}&tournament_id=${tournament_id}&team_id=${team.id}&registration_id=${reg?.id}`
      );
    } else {
      // Free tournament — confirm immediately via server-side RPC
      // (registrations.status can no longer be set directly by clients).
      // One retry: the RPC is safe to call again on a still-pending row (it
      // only rejects if status has already moved on), and a transient
      // network drop is the realistic failure mode here -- there's no "retry
      // confirmation" action anywhere else in the app (History only offers
      // Cancel), so silently failing would strand the player on a pending
      // registration with no way back in short of cancelling and redoing
      // the whole team form.
      let { error: confirmError } = await supabase.rpc('confirm_free_registration', {
        p_registration_id: reg.id,
      });

      if (confirmError) {
        ({ error: confirmError } = await supabase.rpc('confirm_free_registration', {
          p_registration_id: reg.id,
        }));
      }

      if (confirmError) {
        setLoading(false);
        // Team + squad are already saved -- only confirmation failed, so
        // don't claim success. Tell the truth about the only way forward:
        // cancel and re-register, since there's no separate retry action.
        Alert.alert(
          'Team Saved, Confirmation Failed',
          `${teamName} was created, but confirming your registration failed: ${confirmError.message}\n\nYou can cancel this registration from My Registrations and register again, or contact support if it keeps happening.`,
          [{ text: 'OK', onPress: () => router.push('/') }]
        );
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('Profiles')
          .select('push_token, push_enabled')
          .eq('id', user.id)
          .single();

        await notifyAndLog(
          user.id,
          profile?.push_enabled ? profile?.push_token : null,
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
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.heading}>Create Your Team</Text>
        <Text style={styles.sub}>Fill in team name and all 4 squad members. A 5th substitute is optional.</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Team Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Shadow Wolves"
            placeholderTextColor={colors.textDisabled}
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
              placeholderTextColor={colors.textDisabled}
              value={member.in_game_name}
              onChangeText={(val) => updateMember(index, 'in_game_name', val)}
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="UID / Player ID"
              placeholderTextColor={colors.textDisabled}
              value={member.player_uid}
              onChangeText={(val) => updateMember(index, 'player_uid', val)}
              returnKeyType="next"
            />
          </View>
        ))}

        <View style={[styles.memberBox, styles.subBox]}>
          <View style={styles.memberHeader}>
            <View style={[styles.memberIndex, styles.subIndex]}>
              <Text style={styles.memberIndexText}>5</Text>
            </View>
            <Text style={styles.memberTitle}>Substitute (optional)</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="In-Game Name"
            placeholderTextColor={colors.textDisabled}
            value={substitute.in_game_name}
            onChangeText={(val) => updateSubstitute('in_game_name', val)}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            placeholder="UID / Player ID"
            placeholderTextColor={colors.textDisabled}
            value={substitute.player_uid}
            onChangeText={(val) => updateSubstitute('player_uid', val)}
            returnKeyType="done"
          />
        </View>

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

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 60, paddingBottom: 80 },
    headerRow: { marginBottom: 12 },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    heading: { fontSize: 28, fontWeight: '900', color: colors.textPrimary, marginBottom: 4 },
    sub: { fontSize: 14, color: colors.textSecondary, marginBottom: 28 },
    sectionTitle: {
      color: colors.textFaint, fontSize: 11, fontWeight: '800',
      letterSpacing: 2, marginBottom: 12,
    },
    label: { color: colors.textSecondary, fontSize: 13, marginBottom: 8, fontWeight: '600' },
    fieldGroup: { marginBottom: 20 },
    input: {
      backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
      borderWidth: 1, borderColor: colors.border, marginBottom: 10,
    },
    memberBox: {
      backgroundColor: colors.surface, borderRadius: 14, padding: 16,
      marginBottom: 12, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    memberHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    memberIndex: {
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: colors.accent, justifyContent: 'center',
      alignItems: 'center', marginRight: 10,
    },
    memberIndexText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    memberTitle: { color: colors.accent, fontSize: 13, fontWeight: '700' },
    subBox: { borderColor: colors.warning, borderStyle: 'dashed' },
    subIndex: { backgroundColor: colors.warning },
    feeNote: {
      backgroundColor: '#1a1a00', borderRadius: 10, padding: 14,
      marginBottom: 20, borderWidth: 1, borderColor: '#3a3a00',
    },
    feeNoteText: { color: colors.warning, fontSize: 13, fontWeight: '600' },
    button: {
      backgroundColor: colors.accent, paddingVertical: 16,
      borderRadius: 12, alignItems: 'center', marginTop: 8,
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
}