import { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { AntDesign } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import FragifyLogo from '@/components/FragifyLogo';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  async function signInWithGoogle() {
    if (googleLoading) return;

    setGoogleLoading(true);

    try {
      // Custom deep-link for the native development/production build.
      // This must also be added to Supabase Auth > URL Configuration.
      const redirectUrl = 'tournamentapp://select-role';

      console.log('Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        console.log('OAuth start error:', error.message);

        Alert.alert(
          'Google Sign-In Error',
          error.message
        );

        return;
      }

      if (!data?.url) {
        Alert.alert(
          'Google Sign-In Error',
          'Supabase did not return an OAuth URL.'
        );

        return;
      }

      console.log('Opening OAuth URL:', data.url);
      console.log('Waiting for redirect:', redirectUrl);

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      console.log('Auth result:', result.type);

      if (result.type === 'cancel') {
        console.log('Google sign-in cancelled.');
        return;
      }

      if (result.type !== 'success' || !result.url) {
        console.log('Unexpected auth result:', result);
        return;
      }

      console.log('OAuth callback URL:', result.url);

      /*
       * Supabase OAuth can return:
       *
       * 1. access_token + refresh_token
       * 2. authorization code
       */
      const { params, errorCode } =
        QueryParams.getQueryParams(result.url);

      if (errorCode) {
        console.log(
          'OAuth callback error:',
          errorCode
        );

        Alert.alert(
          'Google Sign-In Error',
          errorCode
        );

        return;
      }

      const accessToken = params.access_token;
      const refreshToken = params.refresh_token;
      const code = params.code;

      // --------------------------------------------------
      // Implicit flow: access token + refresh token
      // --------------------------------------------------
      if (accessToken && refreshToken) {
        console.log('Received OAuth tokens.');

        const { error: sessionError } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

        if (sessionError) {
          console.log(
            'Session error:',
            sessionError.message
          );

          Alert.alert(
            'Sign-In Error',
            sessionError.message
          );

          return;
        }

        console.log(
          'Supabase session created successfully.'
        );

        return;
      }

      // --------------------------------------------------
      // PKCE flow: authorization code
      // --------------------------------------------------
      if (code) {
        console.log(
          'Received OAuth authorization code.'
        );

        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(
            code
          );

        if (exchangeError) {
          console.log(
            'Code exchange error:',
            exchangeError.message
          );

          Alert.alert(
            'Sign-In Error',
            exchangeError.message
          );

          return;
        }

        console.log(
          'Supabase session created successfully.'
        );

        return;
      }

      // --------------------------------------------------
      // No credentials returned
      // --------------------------------------------------
      console.log(
        'OAuth callback did not contain tokens or code.'
      );

      Alert.alert(
        'Google Sign-In Error',
        'Google redirected back, but no authentication session was received.'
      );
    } catch (error) {
      console.log(
        'Google sign-in exception:',
        error
      );

      Alert.alert(
        'Google Sign-In Error',
        error instanceof Error
          ? error.message
          : 'Something went wrong while signing in with Google.'
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.glowCircle} />

      <View style={styles.logoBox}>
        <View style={styles.logoRing}>
          <FragifyLogo
            size={64}
            withBackground={false}
          />
        </View>

        <Text style={styles.appName}>
          FRAGIFY
        </Text>

        <Text style={styles.appTagline}>
          ESPORTS · COMPETE · WIN
        </Text>
      </View>

      <Text style={styles.title}>
        Welcome back
      </Text>

      <Text style={styles.subtitle}>
        Sign in with Google to continue
      </Text>

      <TouchableOpacity
        style={styles.googleButton}
        onPress={signInWithGoogle}
        disabled={googleLoading}
        activeOpacity={0.85}
      >
        <AntDesign
          name="google"
          size={20}
          color="#DB4437"
          style={{ marginRight: 10 }}
        />

        <Text style={styles.googleButtonText}>
          {googleLoading
            ? 'Connecting...'
            : 'Continue with Google'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.footerText}>
        By continuing, you agree to our{' '}

        <Text
          style={styles.footerLink}
          onPress={() =>
            router.push('/terms-of-service')
          }
        >
          Terms of Service
        </Text>

        {' '}and{' '}

        <Text
          style={styles.footerLink}
          onPress={() =>
            router.push('/privacy-policy')
          }
        >
          Privacy Policy
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },

  glowCircle: {
    position: 'absolute',
    top: -120,
    alignSelf: 'center',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: '#7C3AED',
    opacity: 0.16,
  },

  logoBox: {
    alignItems: 'center',
    marginBottom: 48,
  },

  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#150f24',
    borderWidth: 1,
    borderColor: '#7C3AED44',
    shadowColor: '#7C3AED',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },

  appName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 16,
  },

  appTagline: {
    color: '#555555',
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 4,
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: '#aaaaaa',
    marginBottom: 32,
    textAlign: 'center',
  },

  googleButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },

  googleButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '700',
  },

  footerText: {
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },

  footerLink: {
    color: '#7C3AED',
    fontWeight: '700',
  },
});