import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const AUDIENCES = [
  { label: 'Everyone', value: 'all' },
  { label: 'Players only', value: 'player' },
  { label: 'Hosts only', value: 'host' },
];

export default function AdminBroadcast() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);

  async function sendBroadcast() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Missing', 'Add both a title and a message.');
      return;
    }

    setSending(true);

    const { data, error } = await supabase.rpc('get_broadcast_recipients', {
      target_role: audience,
    });

    if (error) {
      setSending(false);
      Alert.alert('Error', error.message);
      return;
    }

    const recipients = data ?? [];

    if (recipients.length === 0) {
      setSending(false);
      Alert.alert('No recipients', 'No users found for that audience.');
      return;
    }

    // Log an in-app notification for every recipient
    const logResults = await Promise.all(
      recipients.map((r: any) =>
        supabase.rpc('insert_notification', {
          p_user_id: r.user_id,
          p_title: title.trim(),
          p_body: body.trim(),
          p_tournament_id: null,
        })
      )
    );

    const failedLogs = logResults.filter((res) => res.error);
    if (failedLogs.length > 0) {
      console.log('Some notification logs failed:', failedLogs.map(f => f.error?.message));
    }

    // Send actual push notifications, chunked
    const tokens = recipients.map((r: any) => r.push_token).filter(Boolean);
    const chunkSize = 100;

    for (let i = 0; i < tokens.length; i += chunkSize) {
      const chunk = tokens.slice(i, i + chunkSize);
      const messages = chunk.map((token: string) => ({
        to: token,
        sound: 'default',
        title: title.trim(),
        body: body.trim(),
      }));

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
    }

    setSending(false);
    Alert.alert(
      'Sent! 🚀',
      `Logged for ${recipients.length} user(s), pushed to ${tokens.length} device(s).`
    );
    setTitle('');
    setBody('');
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.heading}>📢 Send Broadcast</Text>
      <Text style={styles.sub}>
        Send a custom push notification to your users — Swiggy/Zomato style.
      </Text>

      <Text style={styles.label}>AUDIENCE</Text>
      <View style={styles.audienceRow}>
        {AUDIENCES.map((a) => (
          <TouchableOpacity
            key={a.value}
            style={[styles.audienceChip, audience === a.value && styles.audienceChipActive]}
            onPress={() => setAudience(a.value)}
          >
            <Text style={[styles.audienceChipText, audience === a.value && styles.audienceChipTextActive]}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>TITLE</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. New tournaments just dropped 🔥"
        placeholderTextColor="#444"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>MESSAGE</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="e.g. 3 new BGMI tournaments are live — squad up before slots run out!"
        placeholderTextColor="#444"
        value={body}
        onChangeText={setBody}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity style={styles.sendBtn} onPress={sendBroadcast} disabled={sending}>
        {sending
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.sendBtnText}>Send Broadcast 🚀</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24, paddingTop: 60 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  heading: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  sub: { color: '#888', fontSize: 13, marginBottom: 24 },
  label: { color: '#aaa', fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 4, letterSpacing: 1 },
  audienceRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  audienceChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  audienceChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  audienceChipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  audienceChipTextActive: { color: '#fff' },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 16,
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  sendBtn: {
    backgroundColor: '#7C3AED', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});