import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { uploadBanner } from '@/lib/bannerUpload';
import { pickRawChatImage, RawImage } from '@/lib/chatImage';
import ImageCropPreview from '@/components/ImageCropPreview';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const BANNER_RATIO = 22 / 9;

const CATEGORIES: { value: 'tournament' | 'scrim'; label: string }[] = [
  { value: 'tournament', label: 'Tournament' },
  { value: 'scrim', label: 'Scrim' },
];
const LOBBY_TYPES: { value: 'mini' | 'mega'; label: string; defaultMatchCount: number }[] = [
  { value: 'mini', label: 'Mini Lobby', defaultMatchCount: 3 },
  { value: 'mega', label: 'Mega Lobby', defaultMatchCount: 5 },
];
const DEFAULT_PLACEMENT_POINTS = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const DEFAULT_KILL_POINT = 1;

export default function EditTournament() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [category, setCategory] = useState<'tournament' | 'scrim'>('tournament');
  const [lobbyType, setLobbyType] = useState<'mini' | 'mega'>('mini');
  const [matchCount, setMatchCount] = useState('1');
  const [customizePoints, setCustomizePoints] = useState(false);
  const [placementPoints, setPlacementPoints] = useState<string[]>(
    DEFAULT_PLACEMENT_POINTS.map(String)
  );
  const [killPoint, setKillPoint] = useState(String(DEFAULT_KILL_POINT));
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [rawBannerImage, setRawBannerImage] = useState<RawImage | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    rules: '',
    entry_fee: '',
    prize_pool: '',
    max_teams: '',
  });
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => { fetchTournament(); }, []);

  const selectCategory = (value: 'tournament' | 'scrim') => {
    setCategory(value);
    if (value === 'tournament') {
      setMatchCount('1');
    } else {
      const lobby = LOBBY_TYPES.find((l) => l.value === lobbyType) ?? LOBBY_TYPES[0];
      setMatchCount(String(lobby.defaultMatchCount));
    }
  };

  const selectLobbyType = (value: 'mini' | 'mega') => {
    setLobbyType(value);
    const lobby = LOBBY_TYPES.find((l) => l.value === value)!;
    setMatchCount(String(lobby.defaultMatchCount));
  };

  const handlePickBanner = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'Not logged in.');
      return;
    }

    const image = await pickRawChatImage('library');
    if (image) setRawBannerImage(image);
  };

  const handleBannerCropConfirm = async (cropped: RawImage) => {
    setRawBannerImage(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploadingBanner(true);
    try {
      const url = await uploadBanner(user.id, cropped);
      setBannerUrl(url);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to upload banner.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const updatePlacementPoint = (rankIndex: number, value: string) => {
    setPlacementPoints((prev) => {
      const next = [...prev];
      next[rankIndex] = value;
      return next;
    });
  };

  async function fetchTournament() {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    setForm({
      title: data.title ?? '',
      description: data.description ?? '',
      rules: data.rules ?? '',
      entry_fee: String(data.entry_fee ?? 0),
      prize_pool: String(data.prize_pool ?? 0),
      max_teams: String(data.max_teams ?? 12),
    });

    setCategory(data.category === 'scrim' ? 'scrim' : 'tournament');
    setLobbyType(data.lobby_type === 'mega' ? 'mega' : 'mini');
    setMatchCount(String(data.match_count ?? 1));

    const rules = data.point_rules ?? {};
    const placement = Array.isArray(rules.placement) ? rules.placement : DEFAULT_PLACEMENT_POINTS;
    setPlacementPoints(placement.map(String));
    setKillPoint(String(rules.kill_point ?? DEFAULT_KILL_POINT));
    const isCustom =
      JSON.stringify(placement) !== JSON.stringify(DEFAULT_PLACEMENT_POINTS) ||
      (rules.kill_point ?? DEFAULT_KILL_POINT) !== DEFAULT_KILL_POINT;
    setCustomizePoints(isCustom);

    setBannerUrl(data.banner_url ?? null);

    if (data.start_time) setStartTime(new Date(data.start_time));
    setLoading(false);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      Alert.alert('Missing', 'Title is required.');
      return;
    }

    if (!startTime) {
      Alert.alert('Missing', 'Please select a date and time for the tournament.');
      return;
    }

    const parsedMatchCount = parseInt(matchCount, 10);
    if (!parsedMatchCount || parsedMatchCount < 1) {
      Alert.alert('Missing', 'Match count must be at least 1.');
      return;
    }

    const pointRules = {
      placement: placementPoints.map((p) => parseInt(p, 10) || 0),
      kill_point: parseFloat(killPoint) || 0,
    };

    setSaving(true);
    const { error } = await supabase
      .from('tournaments')
      .update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        rules: form.rules.trim() || null,
        entry_fee: parseFloat(form.entry_fee) || 0,
        prize_pool: parseFloat(form.prize_pool) || 0,
        max_teams: parseInt(form.max_teams) || 12,
        start_time: startTime ? startTime.toISOString() : null,
        category: category,
        lobby_type: category === 'scrim' ? lobbyType : null,
        match_count: parsedMatchCount,
        point_rules: pointRules,
        banner_url: bannerUrl,
      })
      .eq('id', id);

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Updated! ✅', 'Tournament details saved.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }
  }

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.heading}>Edit Tournament</Text>
        <Text style={styles.sub}>Update your tournament details.</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Banner Image</Text>
          <TouchableOpacity
            style={styles.bannerBox}
            onPress={handlePickBanner}
            disabled={uploadingBanner}
          >
            {uploadingBanner ? (
              <ActivityIndicator color={colors.accent} />
            ) : bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={styles.bannerImage} contentFit="cover" />
            ) : (
              <View style={styles.bannerBoxEmpty}>
                <Ionicons name="image-outline" size={28} color={colors.textFaint} />
                <Text style={styles.bannerBoxText}>Tap to add a banner image</Text>
              </View>
            )}
          </TouchableOpacity>
          {bannerUrl && !uploadingBanner && (
            <TouchableOpacity onPress={handlePickBanner}>
              <Text style={styles.customizeLink}>Change Banner</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.label}>Event Type *</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.value}
              style={[styles.chip, category === c.value && styles.chipActive]}
              onPress={() => selectCategory(c.value)}
            >
              <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {category === 'scrim' && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Lobby Type *</Text>
            <View style={styles.chipRow}>
              {LOBBY_TYPES.map((l) => (
                <TouchableOpacity
                  key={l.value}
                  style={[styles.chip, lobbyType === l.value && styles.chipActive]}
                  onPress={() => selectLobbyType(l.value)}
                >
                  <Text style={[styles.chipText, lobbyType === l.value && styles.chipTextActive]}>
                    {l.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Number of Matches *{category === 'scrim' ? ' (default set by lobby type, editable)' : ''}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="1"
            placeholderTextColor={colors.textDisabled}
            keyboardType="numeric"
            value={matchCount}
            onChangeText={setMatchCount}
          />
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.scoringHeaderRow}>
            <Text style={styles.label}>Scoring</Text>
            <TouchableOpacity onPress={() => setCustomizePoints((v) => !v)}>
              <Text style={styles.customizeLink}>
                {customizePoints ? 'Use Default ↺' : '⚙ Customize Points'}
              </Text>
            </TouchableOpacity>
          </View>

          {!customizePoints ? (
            <Text style={styles.scoringDefaultText}>
              Default: #1=12 · #2=9 · #3=8 · #4=7 · #5=6 · #6=5 · #7=4 · #8=3 · #9=2 · #10=1 · 1 kill = 1 pt
            </Text>
          ) : (
            <>
              <View style={styles.pointsGrid}>
                {placementPoints.map((value, i) => (
                  <View key={i} style={styles.pointBox}>
                    <Text style={styles.pointBoxLabel}>#{i + 1}</Text>
                    <TextInput
                      style={styles.pointBoxInput}
                      keyboardType="numeric"
                      value={value}
                      onChangeText={(v) => updatePlacementPoint(i, v)}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.killPointRow}>
                <Text style={styles.label}>Points per Kill</Text>
                <TextInput
                  style={[styles.input, { width: 100 }]}
                  keyboardType="numeric"
                  value={killPoint}
                  onChangeText={setKillPoint}
                />
              </View>
            </>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tournament Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Free Fire Sunday Cup"
            placeholderTextColor={colors.textDisabled}
            value={form.title}
            onChangeText={(val) => setForm(prev => ({ ...prev, title: val }))}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Entry Fee (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textDisabled}
            keyboardType="numeric"
            value={form.entry_fee}
            onChangeText={(val) => setForm(prev => ({ ...prev, entry_fee: val }))}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Prize Pool (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textDisabled}
            keyboardType="numeric"
            value={form.prize_pool}
            onChangeText={(val) => setForm(prev => ({ ...prev, prize_pool: val }))}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Max Teams</Text>
          <TextInput
            style={styles.input}
            placeholder="12"
            placeholderTextColor={colors.textDisabled}
            keyboardType="numeric"
            value={form.max_teams}
            onChangeText={(val) => setForm(prev => ({ ...prev, max_teams: val }))}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            placeholder="Brief description of the tournament..."
            placeholderTextColor={colors.textDisabled}
            multiline
            numberOfLines={4}
            value={form.description}
            onChangeText={(val) => setForm(prev => ({ ...prev, description: val }))}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Rules</Text>
          <TextInput
            style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
            placeholder={`1. No cheating\n2. Must join 10 mins before match`}
            placeholderTextColor={colors.textDisabled}
            multiline
            numberOfLines={5}
            value={form.rules}
            onChangeText={(val) => setForm(prev => ({ ...prev, rules: val }))}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Date & Time</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
            <Text style={styles.dateBtnIcon}>🗓</Text>
            <Text style={styles.dateBtnText}>
              {startTime ? formatDateTime(startTime) : 'Select Date & Time'}
            </Text>
          </TouchableOpacity>
        </View>

        <DateTimePickerModal
          isVisible={showPicker}
          mode="datetime"
          isDarkModeEnabled={false}
          onConfirm={(date) => { setStartTime(date); setShowPicker(false); }}
          onCancel={() => setShowPicker(false)}
        />

        <ImageCropPreview
          visible={!!rawBannerImage}
          image={rawBannerImage}
          fixedRatio={BANNER_RATIO}
          onCancel={() => setRawBannerImage(null)}
          onConfirm={handleBannerCropConfirm}
        />

        <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Save Changes ✅</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 60, paddingBottom: 80 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    headerRow: { marginBottom: 12 },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    heading: { fontSize: 28, fontWeight: '900', color: colors.textPrimary, marginBottom: 4 },
    sub: { fontSize: 14, color: colors.textSecondary, marginBottom: 28 },
    label: { color: colors.textSecondary, fontSize: 13, marginBottom: 8, fontWeight: '600' },
    fieldGroup: { marginBottom: 18 },
    chipRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
    chip: {
      flex: 1, paddingVertical: 10, borderRadius: 10,
      backgroundColor: colors.surfaceAlt, borderWidth: 1,
      borderColor: colors.border, alignItems: 'center',
    },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: '#fff' },
    scoringHeaderRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 8,
    },
    customizeLink: { color: colors.accent, fontSize: 12, fontWeight: '700' },
    scoringDefaultText: {
      color: colors.textMuted, fontSize: 12, lineHeight: 18,
      backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    pointsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    pointBox: {
      width: '18%', backgroundColor: colors.surfaceAlt, borderRadius: 8,
      borderWidth: 1, borderColor: colors.border, padding: 8, alignItems: 'center',
    },
    pointBoxLabel: { color: colors.accent, fontSize: 11, fontWeight: '700', marginBottom: 4 },
    pointBoxInput: {
      color: colors.textPrimary, fontSize: 14, fontWeight: '700', textAlign: 'center',
      width: '100%', paddingVertical: 2,
    },
    killPointRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    bannerBox: {
      height: 140, borderRadius: 12, backgroundColor: colors.surfaceAlt,
      borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    bannerImage: { width: '100%', height: '100%' },
    bannerBoxEmpty: { alignItems: 'center', gap: 8 },
    bannerBoxText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    input: {
      backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 14, fontSize: 15,
      borderWidth: 1, borderColor: colors.border,
    },
    dateBtn: {
      backgroundColor: colors.surfaceAlt, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 16,
      borderWidth: 1, borderColor: colors.accent,
      flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    dateBtnIcon: { fontSize: 18 },
    dateBtnText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    button: {
      backgroundColor: colors.accent, paddingVertical: 16,
      borderRadius: 12, alignItems: 'center', marginTop: 8,
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
}