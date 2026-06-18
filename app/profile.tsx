import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const [username, setUsername] = useState('');
  const [freeFireUid, setFreeFireUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setFetching(false);
      return;
    }

    const { data, error } = await supabase
      .from('Profiles')
      .select('username, free_fire_uid')
      .eq('id', userData.user.id)
      .single();

    if (data) {
      setUsername(data.username || '');
      setFreeFireUid(data.free_fire_uid || '');
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
        free_fire_uid: freeFireUid.trim(),
      });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Saved', 'Profile updated successfully!');
      router.replace('/(tabs)');
    }
  }

  if (fetching) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#534AB7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>
      <Text style={styles.subtitle}>Set up your player details</Text>

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your gamertag"
        value={username}
        onChangeText={setUsername}
      />

      <Text style={styles.label}>Free Fire UID</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your in-game ID"
        value={freeFireUid}
        onChangeText={setFreeFireUid}
        keyboardType="number-pad"
      />

      <TouchableOpacity style={styles.button} onPress={saveProfile} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save Profile'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 32, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, fontSize: 16, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 20 },
  button: { backgroundColor: '#534AB7', paddingVertical: 16, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});