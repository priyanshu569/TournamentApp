import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { notifyAndLog } from '@/lib/notifications';
import FragifyLogo from '@/components/FragifyLogo';

export default function RequestHostAccess() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !contact.trim()) {
      Alert.alert('Missing Fields', 'Please enter your name and a way to contact you.');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      Alert.alert('Error', 'Not logged in.');
      return;
    }

    const { data: requestId, error } = await supabase.rpc('submit_host_request', {
      p_name: name.trim(),
      p_contact: contact.trim(),
      p_details: details.trim() || null,
    });

    if (error) {
      setLoading(false);
      Alert.alert('Error', error.message);
      return;
    }

    try {
      const { data: admins } = await supabase.rpc('notify_admins_of_host_request', {
        p_request_id: requestId,
      });

      await Promise.all(
        (admins ?? []).map((a: any) =>
          notifyAndLog(
            a.user_id,
            a.push_token,
            '🏆 New Host Request',
            `${name.trim()} wants to become a host.`
          )
        )
      );
    } catch (err) {
      console.log('Admin notify error:', err);
    }

    const { data: profile } = await supabase
      .from('Profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    setLoading(false);

    Alert.alert(
      'Request Submitted 🎉',
      "We'll review your request and notify you once it's approved.",
      [
        {
          text: 'OK',
          onPress: () => {
            if (!profile?.username) {
              router.replace('/edit-profile');
            } else {
              router.back();
            }
          },
        },
      ]
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
        <View style={styles.logoBox}>
          <FragifyLogo size={48} />
        </View>

        <Text style={styles.heading}>Request Host Access</Text>
        <Text style={styles.sub}>
          Tell us a bit about yourself. An admin will review your request before you can create tournaments.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Your Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Priyanshu Yadav"
            placeholderTextColor="#444"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Contact (Phone or Email) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 9876543210 or you@email.com"
            placeholderTextColor="#444"
            value={contact}
            onChangeText={setContact}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>What tournaments/games do you plan to run?</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            placeholder="e.g. Weekly BGMI scrims for my community"
            placeholderTextColor="#444"
            multiline
            numberOfLines={4}
            value={details}
            onChangeText={setDetails}
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Submit Request</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 80 },
  logoBox: { alignItems: 'center', marginBottom: 20 },
  heading: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 13, color: '#aaa', marginBottom: 28, textAlign: 'center', lineHeight: 20 },
  fieldGroup: { marginBottom: 18 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  button: {
    backgroundColor: '#7C3AED', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
