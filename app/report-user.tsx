import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const REASONS = ['Spam', 'Harassment', 'Inappropriate content', 'Impersonation', 'Other'];

export default function ReportUserScreen() {
  const { target_user_id, target_message_id } = useLocalSearchParams<{
    target_user_id?: string;
    target_message_id?: string;
  }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reason) {
      Alert.alert('Missing', 'Please select a reason.');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      Alert.alert('Error', 'Not logged in.');
      return;
    }

    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_user_id: target_user_id ?? null,
      reported_message_id: target_message_id ?? null,
      reason: details.trim() ? `${reason}: ${details.trim()}` : reason,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Report Submitted', "Thanks — we'll review this.", [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.heading}>Report</Text>
      <Text style={styles.sub}>Help us understand what happened.</Text>

      <Text style={styles.label}>Reason</Text>
      <View style={styles.reasonGrid}>
        {REASONS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.reasonChip, reason === r && styles.reasonChipActive]}
            onPress={() => setReason(r)}
          >
            <Text style={[styles.reasonChipText, reason === r && styles.reasonChipTextActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Additional details (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Anything else we should know?"
        placeholderTextColor={colors.textDisabled}
        multiline
        numberOfLines={4}
        value={details}
        onChangeText={setDetails}
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Submit Report</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    heading: { fontSize: 26, fontWeight: '900', color: colors.textPrimary, marginBottom: 4 },
    sub: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
    label: { color: colors.textSecondary, fontSize: 13, marginBottom: 10, fontWeight: '600' },
    reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    reasonChip: {
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    reasonChipActive: { backgroundColor: colors.errorMuted, borderColor: colors.error },
    reasonChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    reasonChipTextActive: { color: colors.error, fontWeight: '700' },
    input: {
      backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
      borderWidth: 1, borderColor: colors.border, height: 100, textAlignVertical: 'top',
      marginBottom: 24,
    },
    button: {
      backgroundColor: colors.error, paddingVertical: 16,
      borderRadius: 12, alignItems: 'center',
      shadowColor: colors.error, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
}
