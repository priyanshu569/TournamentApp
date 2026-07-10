import { useState } from 'react';
import {
  View, TouchableOpacity, Text, StyleSheet, Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { AntDesign } from '@expo/vector-icons';
import FragifyLogo from '@/components/FragifyLogo';
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [googleLoading, setGoogleLoading] = useState(false);

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
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <FragifyLogo size={64} />
        <Text style={styles.appName}>FRAGIFY</Text>
        <Text style={styles.appTagline}>ESPORTS · COMPETE · WIN</Text>
      </View>

      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in with Google to continue</Text>

      <TouchableOpacity style={styles.googleButton} onPress={signInWithGoogle} disabled={googleLoading}>
        <AntDesign name="google" size={20} color="#DB4437" style={{ marginRight: 10 }} />
        <Text style={styles.googleButtonText}>{googleLoading ? 'Connecting...' : 'Continue with Google'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0a0a0a' },
  logoBox: { alignItems: 'center', marginBottom: 48 },
  appName: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 3, marginTop: 10 },
  appTagline: { color: '#555', fontSize: 10, letterSpacing: 1.5, marginTop: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#aaa', marginBottom: 32, textAlign: 'center' },
  googleButton: {
    borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#1a1a1a',
    paddingVertical: 16, borderRadius: 12, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
  },
  googleButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
