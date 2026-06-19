import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { AntDesign } from '@expo/vector-icons';
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function sendOtp() {
    if (phone.length < 10) {
      Alert.alert('Invalid number', 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    const fullPhone = `+91${phone}`;

    const { error } = await supabase.auth.signInWithOtp({
      phone: fullPhone,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.push({ pathname: '/verify-otp', params: { phone: fullPhone } });
    }
  }

  async function signInWithGoogle() {
  setGoogleLoading(true);

  const redirectUrl = AuthSession.makeRedirectUri({
  scheme: 'tournamentapp',
  path: 'select-role',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      setGoogleLoading(false);
      Alert.alert('Error', error.message);
      return;
    }

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type === 'success') {
  router.replace('/select-role');
    }
    }

    setGoogleLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tournament App 🏆</Text>
      <Text style={styles.subtitle}>Enter your phone number to continue</Text>

      <View style={styles.inputRow}>
        <Text style={styles.prefix}>+91</Text>
        <TextInput
          style={styles.input}
          placeholder="9876543210"
          keyboardType="phone-pad"
          maxLength={10}
          value={phone}
          onChangeText={setPhone}
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={sendOtp} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send OTP'}</Text>
      </TouchableOpacity>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity style={styles.googleButton} onPress={signInWithGoogle} disabled={googleLoading}>
        <AntDesign name="google" size={20} color="#DB4437" style={{ marginRight: 10 }} />
        <Text style={styles.googleButtonText}>{googleLoading ? 'Connecting...' : 'Continue with Google'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 32, textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, marginBottom: 20, paddingHorizontal: 12 },
  prefix: { fontSize: 16, color: '#333', marginRight: 8 },
  input: { flex: 1, fontSize: 16, paddingVertical: 14 },
  button: { backgroundColor: '#534AB7', paddingVertical: 16, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { marginHorizontal: 12, color: '#999', fontSize: 13 },
  googleButton: { borderWidth: 1, borderColor: '#ddd', paddingVertical: 16, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  googleButtonText: { color: '#333', fontSize: 16, fontWeight: '600' },
});
