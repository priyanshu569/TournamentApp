import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { supabase } from '@/lib/supabase';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { AppThemeProvider, useAppTheme } from '@/lib/ThemeContext';
import { AvatarPreviewProvider } from '@/lib/AvatarPreviewContext';

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AvatarPreviewProvider>
        <RootLayoutInner />
      </AvatarPreviewProvider>
    </AppThemeProvider>
  );
}

function RootLayoutInner() {
  const { colors } = useAppTheme();

  /**
   * Check the current authentication session
   * and redirect the user to the correct onboarding/home screen.
   */
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          console.error('Error checking session:', sessionError);
          router.replace('/login');
          return;
        }

        if (!session) {
          router.replace('/login');
          return;
        }

        // Session exists — check whether the user's profile
        // has completed the required setup steps.
        const { data: profile, error: profileError } = await supabase
          .from('Profiles')
          .select('role, username, display_name, games_onboarded')
          .eq('id', session.user.id)
          .single();

        if (!mounted) return;

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        }

        if (!profile || !profile.role) {
          router.replace('/select-role');
        } else if (!profile.username || !profile.display_name) {
          router.replace('/edit-profile');
        } else if (!profile.games_onboarded) {
          router.replace('/game-details');
        } else {
          router.replace('/(tabs)');
        }
      } catch (error) {
        console.error('Session check failed:', error);

        if (mounted) {
          router.replace('/login');
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Listen for authentication state changes.
   *
   * This handles:
   * - Google OAuth sign-in
   * - Normal sign-in
   * - Sign-out
   */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);

      if (event === 'SIGNED_IN' && session) {
        try {
          // Register this device for push notifications.
          await registerForPushNotificationsAsync(session.user.id);
        } catch (error) {
          console.error(
            'Push notification registration failed:',
            error
          );
        }

        try {
          // Check profile after sign-in.
          const { data: profile, error: profileError } = await supabase
            .from('Profiles')
            .select('role, username, display_name, games_onboarded')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.error(
              'Error fetching profile after sign-in:',
              profileError
            );
          }

          if (!profile || !profile.role) {
            router.replace('/select-role');
          } else if (!profile.username || !profile.display_name) {
            router.replace('/edit-profile');
          } else if (!profile.games_onboarded) {
            router.replace('/game-details');
          } else {
            router.replace('/(tabs)');
          }
        } catch (error) {
          console.error(
            'Post-sign-in profile check failed:',
            error
          );

          router.replace('/login');
        }
      }

      if (event === 'SIGNED_OUT') {
        router.replace('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Handle notification taps.
   *
   * conversation_id -> chat thread
   * tournament_id   -> tournament details
   */
  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data =
            response.notification.request.content.data;

          console.log('Notification tapped:', data);

          if (data?.conversation_id) {
            router.push({
              pathname: '/chat-thread',
              params: {
                id: String(data.conversation_id),
              },
            });

            return;
          }

          if (data?.tournament_id) {
            router.push({
              pathname: '/tournament-details',
              params: {
                id: String(data.tournament_id),
              },
            });
          }
        }
      );

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        {/* Authentication / Onboarding */}

        <Stack.Screen
          name="login"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="select-role"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="edit-profile"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="game-details"
          options={{ headerShown: false }}
        />

        {/* Main application */}

        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />

        {/* Tournament */}

        <Stack.Screen
          name="create-tournament"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="edit-tournament"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="tournament-details"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="registrations"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="enter-results"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="live-scoreboard"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="leaderboard"
          options={{ headerShown: false }}
        />

        {/* Teams / Payments */}

        <Stack.Screen
          name="create-team"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="payment"
          options={{ headerShown: false }}
        />

        {/* Notifications */}

        <Stack.Screen
          name="notifications"
          options={{ headerShown: false }}
        />

        {/* Admin */}

        <Stack.Screen
          name="admin-broadcast"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="request-host-access"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="admin-host-requests"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="admin-reports"
          options={{ headerShown: false }}
        />

        {/* Profile / Settings */}

        <Stack.Screen
          name="settings"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="profile-banner"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="user-profile"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="follow-list"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="search-users"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="report-user"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="blocked-users"
          options={{ headerShown: false }}
        />

        {/* Chat */}

        <Stack.Screen
          name="chat"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="chat-thread"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="chat-search"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="world-chat"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="world-chat-thread"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="new-group"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="group-info"
          options={{ headerShown: false }}
        />

        {/* Other */}

        <Stack.Screen
          name="support"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="privacy-policy"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="terms-of-service"
          options={{ headerShown: false }}
        />
      </Stack>

      <StatusBar style={colors.statusBar} />
    </GestureHandlerRootView>
  );
}