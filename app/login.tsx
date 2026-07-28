import { useMemo, useState } from 'react';
import {
  View, TouchableOpacity, Text, StyleSheet, Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { AntDesign } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import FragifyLogo from '@/components/FragifyLogo';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

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
      <View style={styles.glowCircle} />

      <View style={styles.logoBox}>
        <View style={styles.logoRing}>
          <FragifyLogo size={64} withBackground={false} />
        </View>
        <Text style={styles.appName}>FRAGIFY</Text>
        <Text style={styles.appTagline}>ESPORTS · COMPETE · WIN</Text>
      </View>

      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in with Google to continue</Text>

      <TouchableOpacity style={styles.googleButton} onPress={signInWithGoogle} disabled={googleLoading} activeOpacity={0.85}>
        <AntDesign name="google" size={20} color="#DB4437" style={{ marginRight: 10 }} />
        <Text style={styles.googleButtonText}>{googleLoading ? 'Connecting...' : 'Continue with Google'}</Text>
      </TouchableOpacity>

      <Text style={styles.footerText}>
        By continuing, you agree to our{' '}
        <Text style={styles.footerLink} onPress={() => router.push('/privacy-policy')}>Privacy Policy</Text>
      </Text>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background, overflow: 'hidden' },
    glowCircle: {
      position: 'absolute', top: -120, alignSelf: 'center',
      width: 340, height: 340, borderRadius: 170,
      backgroundColor: colors.accent, opacity: 0.16,
    },
    logoBox: { alignItems: 'center', marginBottom: 48 },
    logoRing: {
      width: 96, height: 96, borderRadius: 48,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: '#150f24', borderWidth: 1, borderColor: '#7C3AED44',
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
    },
    appName: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: 3, marginTop: 16 },
    appTagline: { color: colors.textFaint, fontSize: 10, letterSpacing: 1.5, marginTop: 4 },
    title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 32, textAlign: 'center' },
    googleButton: {
      backgroundColor: '#fff',
      paddingVertical: 16, borderRadius: 14, alignItems: 'center',
      flexDirection: 'row', justifyContent: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    },
    googleButtonText: { color: '#1a1a1a', fontSize: 16, fontWeight: '700' },
    footerText: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
    footerLink: { color: colors.accent, fontWeight: '700' },
  });
}
