import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(userId: string) {
  try {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device.');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied.');
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.log('No EAS projectId found in app.json — cannot fetch push token.');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    console.log('Got push token:', token);

    const { error } = await supabase
      .from('Profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.log('Failed to save push token:', error.message);
    }

    return token;
  } catch (err) {
    console.log('Push registration error:', err);
  }
}

export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, any> = {}
) {
  const validTokens = tokens.filter(Boolean);
  if (validTokens.length === 0) return;

  const messages = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
  }));

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });
}

/**
 * Sends a push (if a token is available) AND logs the notification
 * to the in-app notifications table, so it shows up in the bell icon
 * even if the push is missed/dismissed.
 */
export async function notifyAndLog(
  userId: string,
  pushToken: string | null | undefined,
  title: string,
  body: string,
  tournamentId?: string
) {
  const { error } = await supabase.rpc('insert_notification', {
    p_user_id: userId,
    p_title: title,
    p_body: body,
    p_tournament_id: tournamentId ?? null,
  });

  if (error) {
    console.log('Failed to log notification:', error.message);
  }

  if (pushToken) {
    await sendPushNotification([pushToken], title, body, { tournament_id: tournamentId });
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.log('Failed to fetch unread count:', error.message);
    return 0;
  }

  return count ?? 0;
}