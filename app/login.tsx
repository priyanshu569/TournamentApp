import { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, Text, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { AntDesign } from '@expo/vector-icons';
import FragifyLogo from '@/components/FragifyLogo';
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

    console.log('Redirect URL:', redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      setGoogleLoading(false);
      Alert.alert('Error', error.message);
      return;
    }

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      console.log('Auth result:', result.type);

      if (result.type === 'success' && result.url) {
        const url = result.url;
        console.log('Result URL:', url);

        try {
          const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1] || '');
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.log('Session error:', sessionError.message);
              Alert.alert('Error', sessionError.message);
            }
          } else {
            await supabase.auth.exchangeCodeForSession(url);
          }
        } catch (err) {
          console.log('Token parse error:', err);
        }
      }
    }

    setGoogleLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.logoBox}>
            <FragifyLogo size={64} />
            <Text style={styles.appName}>FRAGIFY</Text>
            <Text style={styles.appTagline}>ESPORTS · COMPETE · WIN</Text>
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Enter your phone number to continue</Text>

          <View style={styles.inputRow}>
            <Text style={styles.prefix}>+91</Text>
            <TextInput
              style={styles.input}
              placeholder="9876543210"
              placeholderTextColor="#444"
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
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0a0a0a' },
  logoBox: { alignItems: 'center', marginBottom: 36 },
  appName: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 3, marginTop: 10 },
  appTagline: { color: '#555', fontSize: 10, letterSpacing: 1.5, marginTop: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#aaa', marginBottom: 32, textAlign: 'center' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, marginBottom: 20, paddingHorizontal: 14,
  },
  prefix: { fontSize: 16, color: '#aaa', marginRight: 8, fontWeight: '600' },
  input: { flex: 1, fontSize: 16, paddingVertical: 14, color: '#fff' },
  button: { backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2a2a2a' },
  dividerText: { marginHorizontal: 12, color: '#555', fontSize: 13, fontWeight: '600' },
  googleButton: {
    borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#1a1a1a',
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
  },
  googleButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});