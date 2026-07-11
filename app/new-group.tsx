import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';

export default function NewGroupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadCandidates(); }, []);

  async function loadCandidates() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id;
    if (!me) { setLoading(false); return; }

    const { data: asFollower } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', me);

    const { data: asFollowing } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', me);

    const otherIds = [...new Set([
      ...(asFollower ?? []).map((r: any) => r.following_id),
      ...(asFollowing ?? []).map((r: any) => r.follower_id),
    ])];

    if (otherIds.length === 0) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('id, username, avatar_id')
      .in('id', otherIds);

    setCandidates(profiles ?? []);
    setLoading(false);
  }

  function toggleSelect(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Missing', 'Please enter a group name.');
      return;
    }
    if (selected.size === 0) {
      Alert.alert('Missing', 'Select at least one person to add.');
      return;
    }

    setCreating(true);
    const { data: conversationId, error } = await supabase.rpc('create_group_conversation', {
      p_name: name.trim(),
      p_member_ids: Array.from(selected),
    });
    setCreating(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    router.replace(`/chat-thread?id=${conversationId}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Group</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.fieldGroup}>
        <TextInput
          style={styles.input}
          placeholder="Group name"
          placeholderTextColor="#444"
          value={name}
          onChangeText={setName}
        />
      </View>

      <Text style={styles.label}>Add people you follow or who follow you</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Follow some people first, or wait for someone to follow you.
            </Text>
          }
          renderItem={({ item }) => {
            const isSelected = selected.has(item.id);
            return (
              <TouchableOpacity style={styles.row} onPress={() => toggleSelect(item.id)}>
                <Avatar avatarId={item.avatar_id} username={item.username} size={44} />
                <Text style={styles.rowName}>{item.username ?? 'Unknown'}</Text>
                <Ionicons
                  name={isSelected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isSelected ? '#7C3AED' : '#555'}
                />
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={creating}>
        {creating
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Create Group ({selected.size})</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  fieldGroup: { paddingHorizontal: 24, marginBottom: 12 },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', paddingHorizontal: 24, marginBottom: 12 },
  listContent: { paddingHorizontal: 24, paddingBottom: 16 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: '#2a2a2a',
  },
  rowName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  button: {
    backgroundColor: '#7C3AED', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginHorizontal: 24, marginBottom: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
