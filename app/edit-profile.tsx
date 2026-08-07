import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet, Text,
  TextInput, TouchableOpacity, View, KeyboardAvoidingView,
  Platform, ScrollView, Modal, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import FragifyLogo from '@/components/FragifyLogo';
import Avatar from '@/components/Avatar';
import { AVATAR_PRESETS } from '@/lib/avatars';
import { INDIAN_STATES } from '@/lib/indianStates';
import { pickAndUploadAvatarPhoto } from '@/lib/avatarUpload';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/;
const BIO_MAX_LENGTH = 160;

export default function EditProfileScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [cityPublic, setCityPublic] = useState(true);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [agePublic, setAgePublic] = useState(true);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [gamesOnboarded, setGamesOnboarded] = useState(true);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
      .select('username, display_name, bio, gender, state, city, city_public, date_of_birth, age_public, avatar_id, avatar_url, games_onboarded')
      .eq('id', userData.user.id)
      .single();

    if (data) {
      setUsername(data.username || '');
      setDisplayName(data.display_name || '');
      setBio(data.bio || '');
      setGender(data.gender || null);
      setState(data.state || null);
      setCity(data.city || '');
      setCityPublic(data.city_public !== false);
      setDateOfBirth(data.date_of_birth ? new Date(data.date_of_birth) : null);
      setAgePublic(data.age_public !== false);
      setAvatarId(data.avatar_id || null);
      setAvatarUrl(data.avatar_url || null);
      setGamesOnboarded(!!data.games_onboarded);
    }
    setFetching(false);
  }

  async function handleUploadPhoto() {
    if (!userId) return;
    setUploadingPhoto(true);
    try {
      const url = await pickAndUploadAvatarPhoto(userId);
      if (url) {
        setAvatarUrl(url);
        setAvatarId(null);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setUploadingPhoto(false);
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
        bio: bio.trim() || null,
        gender,
        state,
        city: city.trim() || null,
        city_public: cityPublic,
        date_of_birth: dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : null,
        age_public: agePublic,
        avatar_id: avatarId,
        avatar_url: avatarUrl,
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
        <ActivityIndicator size="large" color={colors.accent} />
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
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
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

          <TouchableOpacity style={styles.photoRow} onPress={handleUploadPhoto} disabled={uploadingPhoto}>
            {avatarUrl ? (
              <Avatar avatarUrl={avatarUrl} size={56} />
            ) : (
              <View style={styles.photoPlaceholder}>
                {uploadingPhoto
                  ? <ActivityIndicator color={colors.accent} />
                  : <Ionicons name="camera" size={22} color={colors.accent} />
                }
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.photoRowTitle}>{avatarUrl ? 'Change Photo' : 'Upload a Photo'}</Text>
              <Text style={styles.photoRowSubtitle}>Use your own photo instead of an avatar below</Text>
            </View>
            {avatarUrl && (
              <TouchableOpacity onPress={() => setAvatarUrl(null)} style={styles.photoRemoveBtn}>
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <View style={styles.avatarGrid}>
            {AVATAR_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={[styles.avatarOption, !avatarUrl && avatarId === preset.id && styles.avatarOptionActive]}
                onPress={() => { setAvatarId(avatarId === preset.id ? null : preset.id); setAvatarUrl(null); }}
              >
                <Avatar avatarId={preset.id} size={52} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.hint}>
            {avatarUrl
              ? 'Using your uploaded photo. Tap an avatar below to switch back to a preset.'
              : 'Tap an avatar to select it, or tap it again to use your initials instead.'}
          </Text>
        </View>

        {/* Username */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username *</Text>
          <View style={styles.usernameInputRow}>
            <Text style={styles.usernamePrefix}>@</Text>
            <TextInput
              style={styles.usernameInput}
              placeholder="yourhandle"
              placeholderTextColor={colors.textDisabled}
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            {usernameStatus === 'checking' && <ActivityIndicator size="small" color={colors.accent} />}
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
            placeholderTextColor={colors.textDisabled}
            value={displayName}
            onChangeText={setDisplayName}
          />
        </View>

        {/* Bio */}
        <View style={styles.fieldGroup}>
          <View style={styles.bioLabelRow}>
            <Text style={styles.label}>Bio</Text>
            <Text style={[styles.bioCounter, bio.length >= BIO_MAX_LENGTH && styles.bioCounterMax]}>
              {bio.length}/{BIO_MAX_LENGTH}
            </Text>
          </View>
          <TextInput
            style={[styles.input, styles.bioInput]}
            placeholder="Tell other players a bit about yourself..."
            placeholderTextColor={colors.textDisabled}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={BIO_MAX_LENGTH}
            textAlignVertical="top"
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
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* City */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>City (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Share your city if you'd like"
            placeholderTextColor={colors.textDisabled}
            value={city}
            onChangeText={setCity}
          />
          <View style={styles.visibilityRow}>
            <Text style={styles.visibilityLabel}>Show my city on my public profile</Text>
            <Switch
              value={cityPublic}
              onValueChange={setCityPublic}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
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
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          {dateOfBirth && (
            <>
              <Text style={styles.hint}>Age: {calculateAge(dateOfBirth)}</Text>
              <View style={styles.visibilityRow}>
                <Text style={styles.visibilityLabel}>Show my age on my public profile</Text>
                <Switch
                  value={agePublic}
                  onValueChange={setAgePublic}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>
            </>
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
                  {state === s && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 80, paddingBottom: 48 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    },
    logoBox: { alignItems: 'center', marginBottom: 32 },
    appName: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: 3 },
    title: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 32, textAlign: 'center', lineHeight: 20 },
    fieldGroup: { marginBottom: 20 },
    label: { color: colors.textSecondary, fontSize: 13, marginBottom: 8, fontWeight: '600' },
    bioLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    bioCounter: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
    bioCounterMax: { color: colors.warning },
    bioInput: { height: 90, paddingTop: 14 },
    hint: { color: colors.textFaint, fontSize: 12, marginTop: 6 },
    visibilityRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 10, backgroundColor: colors.surface, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.borderMuted,
    },
    visibilityLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', flex: 1, marginRight: 10 },
    hintSuccess: { color: colors.success },
    hintError: { color: colors.error },
    photoRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 14, padding: 12,
      marginBottom: 14, borderWidth: 1, borderColor: colors.borderMuted,
    },
    photoPlaceholder: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentMuted,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1, borderColor: '#7C3AED44', borderStyle: 'dashed',
    },
    photoRowTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    photoRowSubtitle: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
    photoRemoveBtn: {
      width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    avatarOption: {
      padding: 4, borderRadius: 32, borderWidth: 2, borderColor: 'transparent',
    },
    avatarOptionActive: {
      borderColor: colors.accent,
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6, shadowRadius: 8, elevation: 4,
    },
    input: {
      backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
      borderWidth: 1, borderColor: colors.border,
    },
    usernameInputRow: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.surfaceAlt, borderRadius: 10,
      paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border,
    },
    usernamePrefix: { color: colors.accent, fontSize: 15, fontWeight: '700' },
    usernameInput: { flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 14 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: '#fff' },
    selectBtn: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: colors.surfaceAlt, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    selectBtnText: { color: colors.textPrimary, fontSize: 15 },
    selectBtnPlaceholder: { color: colors.textDisabled, fontSize: 15 },
    button: {
      backgroundColor: colors.accent, paddingVertical: 16,
      borderRadius: 12, alignItems: 'center', marginTop: 8,
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    stateSheet: {
      backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34,
      maxHeight: '70%', borderWidth: 1, borderColor: colors.border, borderBottomWidth: 0,
    },
    sheetHandle: {
      width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
      alignSelf: 'center', marginBottom: 16,
    },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
    stateRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border,
    },
    stateRowText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    stateRowTextActive: { color: colors.accent, fontWeight: '700' },
  });
}
