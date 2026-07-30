import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { supabase } from '@/lib/supabase';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { AppThemeProvider, useAppTheme } from '@/lib/ThemeContext';

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootLayoutInner />
    </AppThemeProvider>
  );
}

function RootLayoutInner() {
  const { theme, colors } = useAppTheme();

  useEffect(() => {
    // Check existing session on mount
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      // Session exists — check if profile is set up
      const { data: profile } = await supabase
        .from('Profiles')
        .select('role, username, display_name, games_onboarded')
        .eq('id', session.user.id)
        .single();

      if (!profile || !profile.role) {
        router.replace('/select-role');
      } else if (!profile.username || !profile.display_name) {
        router.replace('/edit-profile');
      } else if (!profile.games_onboarded) {
        router.replace('/game-details');
      } else {
        router.replace('/(tabs)');
      }
    }

    checkSession();
  }, []);

  // Listen for auth state changes (handles Google OAuth callback)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);

        if (event === 'SIGNED_IN' && session) {
          await registerForPushNotificationsAsync(session.user.id);

          // Check profile
          const { data: profile } = await supabase
            .from('Profiles')
            .select('role, username, display_name, games_onboarded')
            .eq('id', session.user.id)
            .single();

          if (!profile || !profile.role) {
            router.replace('/select-role');
          } else if (!profile.username || !profile.display_name) {
            router.replace('/edit-profile');
          } else if (!profile.games_onboarded) {
            router.replace('/game-details');
          } else {
            router.replace('/(tabs)');
          }
        }

        if (event === 'SIGNED_OUT') {
          router.replace('/login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Handle tapping a notification
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);
      if (data?.tournament_id) {
        router.push(`/tournament-details?id=${data.tournament_id}`);
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack

          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="select-role" options={{ headerShown: false }} />
          <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
          <Stack.Screen name="game-details" options={{ headerShown: false }} />
          <Stack.Screen name="create-tournament" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
          <Stack.Screen name="edit-tournament" options={{ headerShown: false }} />
          <Stack.Screen name="admin-broadcast" options={{ headerShown: false }} />
          <Stack.Screen name="request-host-access" options={{ headerShown: false }} />
          <Stack.Screen name="admin-host-requests" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="support" options={{ headerShown: false }} />
          <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
          <Stack.Screen name="user-profile" options={{ headerShown: false }} />
          <Stack.Screen name="follow-list" options={{ headerShown: false }} />
          <Stack.Screen name="search-users" options={{ headerShown: false }} />
          <Stack.Screen name="report-user" options={{ headerShown: false }} />
          <Stack.Screen name="chat" options={{ headerShown: false }} />
          <Stack.Screen name="chat-thread" options={{ headerShown: false }} />
          <Stack.Screen name="world-chat" options={{ headerShown: false }} />
          <Stack.Screen name="world-chat-thread" options={{ headerShown: false }} />
          <Stack.Screen name="new-group" options={{ headerShown: false }} />
          <Stack.Screen name="group-info" options={{ headerShown: false }} />
          <Stack.Screen name="admin-reports" options={{ headerShown: false }} />
          <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
          <Stack.Screen name="live-scoreboard" options={{ headerShown: false }} />
          <Stack.Screen name="tournament-details" options={{ headerShown: false }} />
          <Stack.Screen name="registrations" options={{ headerShown: false }} />
          <Stack.Screen name="enter-results" options={{ headerShown: false }} />
          <Stack.Screen name="payment" options={{ headerShown: false }} />
          <Stack.Screen name="create-team" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style={colors.statusBar} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
