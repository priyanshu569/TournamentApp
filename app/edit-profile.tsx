import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet, Text,
  TextInput, TouchableOpacity, View, KeyboardAvoidingView,
  Platform, ScrollView, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import FragifyLogo from '@/components/FragifyLogo';
import Avatar from '@/components/Avatar';
import { AVATAR_PRESETS } from '@/lib/avatars';
import { INDIAN_STATES } from '@/lib/indianStates';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/;

export default function EditProfileScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [gamesOnboarded, setGamesOnboarded] = useState(true);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [statePickerVisible, setStatePickerVisible] = useState(false);
  const [dobPickerVisible, setDobPickerVisible] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);

    if (!username) {
      setUsernameStatus('idle');
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    checkTimer.current = setTimeout(checkUsernameAvailability, 400);

    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [username]);

  async function checkUsernameAvailability() {
    const { data } = await supabase
      .from('Profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (data && data.id !== userId) {
      setUsernameStatus('taken');
    } else {
      setUsernameStatus('available');
    }
  }

  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setFetching(false); return; }
    setUserId(userData.user.id);

    const { data } = await supabase
      .from('Profiles')
      .select('username, display_name, gender, state, date_of_birth, avatar_id, games_onboarded')
      .eq('id', userData.user.id)
      .single();

    if (data) {
      setUsername(data.username || '');
      setDisplayName(data.display_name || '');
      setGender(data.gender || null);
      setState(data.state || null);
      setDateOfBirth(data.date_of_birth ? new Date(data.date_of_birth) : null);
      setAvatarId(data.avatar_id || null);
      setGamesOnboarded(!!data.games_onboarded);
    }
    setFetching(false);
  }

  function handleUsernameChange(text: string) {
    setUsername(text.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
  }

  function calculateAge(dob: Date): number {
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
    return age;
  }

  async function saveProfile() {
    if (!USERNAME_REGEX.test(username)) {
      Alert.alert('Invalid Username', 'Username must be 3-20 characters: lowercase letters, numbers, "_" or "." only.');
      return;
    }
    if (usernameStatus === 'taken') {
      Alert.alert('Username Taken', 'Please choose a different username.');
      return;
    }
    if (!displayName.trim()) {
      Alert.alert('Required', 'Please enter a display name — this is what other players will see.');
      return;
    }

    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      Alert.alert('Error', 'Not logged in');
      return;
    }

    const { error } = await supabase
      .from('Profiles')
      .upsert({
        id: userData.user.id,
        phone: userData.user.phone,
        username,
        display_name: displayName.trim(),
        gender,
        state,
        date_of_birth: dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : null,
        avatar_id: avatarId,
      });

    setLoading(false);

    if (error) {
      if (error.message.includes('profiles_username_unique')) {
        Alert.alert('Username Taken', 'Please choose a different username.');
      } else {
        Alert.alert('Error', error.message);
      }
      return;
    }

    Alert.alert('Saved ✅', 'Profile updated successfully!', [
      {
        text: 'OK',
        onPress: () => {
          if (router.canGoBack()) {
            router.back();
          } else if (!gamesOnboarded) {
            router.replace('/game-details');
          } else {
            router.replace('/(tabs)');
          }
        },
      },
    ]);
  }

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const usernameHint = {
    idle: 'Lowercase letters, numbers, "_" or "." only — 3-20 characters',
    checking: 'Checking availability...',
    available: '✓ Username available',
    taken: '✗ Username already taken',
    invalid: 'Lowercase letters, numbers, "_" or "." only — 3-20 characters',
  }[usernameStatus];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        {router.canGoBack() && (
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        <View style={styles.logoBox}>
          <FragifyLogo size={56} />
          <Text style={styles.appName}>FRAGIFY</Text>
        </View>

        <Text style={styles.title}>Set Up Your Profile</Text>
        <Text style={styles.subtitle}>Your display name is visible to everyone; your username is your unique handle</Text>

        {/* Avatar */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Avatar</Text>
          <View style={styles.avatarGrid}>
            {AVATAR_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={[styles.avatarOption, avatarId === preset.id && styles.avatarOptionActive]}
                onPress={() => setAvatarId(avatarId === preset.id ? null : preset.id)}
              >
                <Avatar avatarId={preset.id} size={52} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>Tap an avatar to select it, or tap it again to use your initials instead.</Text>
        </View>

        {/* Username */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username *</Text>
          <View style={styles.usernameInputRow}>
            <Text style={styles.usernamePrefix}>@</Text>
            <TextInput
              style={styles.usernameInput}
              placeholder="yourhandle"
              placeholderTextColor="#444"
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            {usernameStatus === 'checking' && <ActivityIndicator size="small" color="#7C3AED" />}
          </View>
          <Text style={[
            styles.hint,
            usernameStatus === 'available' && styles.hintSuccess,
            usernameStatus === 'taken' && styles.hintError,
          ]}>
            {usernameHint}
          </Text>
        </View>

        {/* Display Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Display Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="What should other players see?"
            placeholderTextColor="#444"
            value={displayName}
            onChangeText={setDisplayName}
          />
        </View>

        {/* Gender */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.chipRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.value}
                style={[styles.chip, gender === g.value && styles.chipActive]}
                onPress={() => setGender(gender === g.value ? null : g.value)}
              >
                <Text style={[styles.chipText, gender === g.value && styles.chipTextActive]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* State */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>State</Text>
          <TouchableOpacity style={styles.selectBtn} onPress={() => setStatePickerVisible(true)}>
            <Text style={state ? styles.selectBtnText : styles.selectBtnPlaceholder}>
              {state ?? 'Select your state'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Date of Birth */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity style={styles.selectBtn} onPress={() => setDobPickerVisible(true)}>
            <Text style={dateOfBirth ? styles.selectBtnText : styles.selectBtnPlaceholder}>
              {dateOfBirth
                ? dateOfBirth.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Select your date of birth'}
            </Text>
            <Ionicons name="calendar-outline" size={18} color="#666" />
          </TouchableOpacity>
          {dateOfBirth && (
            <Text style={styles.hint}>Age: {calculateAge(dateOfBirth)}</Text>
          )}
        </View>

        <DateTimePickerModal
          isVisible={dobPickerVisible}
          mode="date"
          maximumDate={new Date()}
          isDarkModeEnabled={false}
          date={dateOfBirth ?? new Date(2000, 0, 1)}
          onConfirm={(date) => { setDateOfBirth(date); setDobPickerVisible(false); }}
          onCancel={() => setDobPickerVisible(false)}
        />

        <TouchableOpacity style={styles.button} onPress={saveProfile} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Save Profile 🚀</Text>
          }
        </TouchableOpacity>
      </ScrollView>

      {/* State Picker Modal */}
      <Modal
        visible={statePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setStatePickerVisible(false)}
        >
          <View style={styles.stateSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select State</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {INDIAN_STATES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.stateRow}
                  onPress={() => { setState(s); setStatePickerVisible(false); }}
                >
                  <Text style={[styles.stateRowText, state === s && styles.stateRowTextActive]}>{s}</Text>
                  {state === s && <Ionicons name="checkmark" size={18} color="#7C3AED" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 80, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  logoBox: { alignItems: 'center', marginBottom: 32 },
  appName: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 3 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#aaa', marginBottom: 32, textAlign: 'center', lineHeight: 20 },
  fieldGroup: { marginBottom: 20 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 8, fontWeight: '600' },
  hint: { color: '#555', fontSize: 12, marginTop: 6 },
  hintSuccess: { color: '#00D4AA' },
  hintError: { color: '#ff4444' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  avatarOption: {
    padding: 4, borderRadius: 32, borderWidth: 2, borderColor: 'transparent',
  },
  avatarOptionActive: {
    borderColor: '#7C3AED',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 8, elevation: 4,
  },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  usernameInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1a1a1a', borderRadius: 10,
    paddingHorizontal: 14, borderWidth: 1, borderColor: '#2a2a2a',
  },
  usernamePrefix: { color: '#7C3AED', fontSize: 15, fontWeight: '700' },
  usernameInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  selectBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  selectBtnText: { color: '#fff', fontSize: 15 },
  selectBtnPlaceholder: { color: '#444', fontSize: 15 },
  button: {
    backgroundColor: '#7C3AED', paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  stateSheet: {
    backgroundColor: '#141414', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34,
    maxHeight: '70%', borderWidth: 1, borderColor: '#2a2a2a', borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#333',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 12 },
  stateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#2a2a2a',
  },
  stateRowText: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  stateRowTextActive: { color: '#7C3AED', fontWeight: '700' },
});
