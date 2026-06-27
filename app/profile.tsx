import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet, Text,
  TextInput, TouchableOpacity, View, KeyboardAvoidingView,
  Platform, ScrollView
} from 'react-native';

export default function ProfileScreen() {
  const [username, setUsername] = useState('');
  const [freeFireUid, setFreeFireUid] = useState('');
  const [bgmiUid, setBgmiUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setFetching(false); return; }

    const { data } = await supabase
      .from('Profiles')
      .select('username, free_fire_uid, bgmi_uid')
      .eq('id', userData.user.id)
      .single();

    if (data) {
      setUsername(data.username || '');
      setFreeFireUid(data.free_fire_uid || '');
      setBgmiUid(data.bgmi_uid || '');
    }
    setFetching(false);
  }

  async function saveProfile() {
    if (!username.trim()) {
      Alert.alert('Required', 'Please enter a username');
      return;
    }

    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      Alert.alert('Error', 'Not logged in');
      return;
    }

    const { error } = await supabase
      .from('Profiles')
      .upsert({
        id: userData.user.id,
        phone: userData.user.phone,
        username: username.trim(),
        free_fire_uid: freeFireUid.trim() || null,
        bgmi_uid: bgmiUid.trim() || null,
      });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Saved ✅', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ]);
    }
  }

  if (fetching) {
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
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.logoBox}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>F</Text>
          </View>
          <Text style={styles.appName}>FRAGIFY</Text>
        </View>

        <Text style={styles.title}>Set Up Your Profile</Text>
        <Text style={styles.subtitle}>Your gamertag and UID will be visible to hosts</Text>

        {/* Username */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your gamertag"
            placeholderTextColor="#444"
            value={username}
            onChangeText={setUsername}
          />
        </View>

        {/* Free Fire UID */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Free Fire UID</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your in-game ID"
            placeholderTextColor="#444"
            value={freeFireUid}
            onChangeText={setFreeFireUid}
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>Optional — add this so hosts can verify your identity</Text>
        </View>

        {/* BGMI UID */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>BGMI UID</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your BGMI in-game ID"
            placeholderTextColor="#444"
            value={bgmiUid}
            onChangeText={setBgmiUid}
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>Optional — add this so hosts can verify your identity</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={saveProfile} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Save Profile 🚀</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 80, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  logoBox: { alignItems: 'center', marginBottom: 32 },
  logo: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: '#7C3AED', justifyContent: 'center',
    alignItems: 'center', marginBottom: 8,
  },
  logoText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  appName: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 3 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#aaa', marginBottom: 32, textAlign: 'center', lineHeight: 20 },
  fieldGroup: { marginBottom: 20 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  hint: { color: '#555', fontSize: 12, marginTop: 6 },
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