import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import AnimatedProfileBanner from '@/components/AnimatedProfileBanner';
import AnimatedAvatarRing from '@/components/AnimatedAvatarRing';
import { BANNER_THEMES, BannerTheme } from '@/components/bannerThemes';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function ProfileBannerScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [profile, setProfile] = useState<any>(null);
  const [selected, setSelected] = useState<BannerTheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }

    const { data } = await supabase
      .from('Profiles')
      .select('display_name, username, avatar_id, avatar_url, banner_theme')
      .eq('id', userData.user.id)
      .single();

    if (data) {
      setProfile(data);
      setSelected((data.banner_theme as BannerTheme) ?? null);
    }
    setLoading(false);
  }

  async function handleSave() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setSaving(true);

    const { error } = await supabase
      .from('Profiles')
      .update({ banner_theme: selected })
      .eq('id', userData.user.id);

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Saved ✨', 'Your profile banner has been updated.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Banner</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.previewWrap}>
        <AnimatedProfileBanner theme={selected} classicColors={['#2d1b4e', '#1a0f2e', '#0d0619']} style={styles.previewCard}>
          <AnimatedAvatarRing theme={selected} size={64}>
            <Avatar avatarId={profile?.avatar_id} avatarUrl={profile?.avatar_url} username={profile?.display_name} size={64} />
          </AnimatedAvatarRing>
          <Text style={styles.previewName}>{profile?.display_name ?? 'You'}</Text>
          {profile?.username && <Text style={styles.previewHandle}>@{profile.username}</Text>}
        </AnimatedProfileBanner>
      </View>

      <Text style={styles.sectionLabel}>CHOOSE A STYLE</Text>

      <TouchableOpacity
        style={[styles.optionRow, selected === null && styles.optionRowActive]}
        onPress={() => setSelected(null)}
      >
        <View style={styles.optionSwatchClassic} />
        <View style={{ flex: 1 }}>
          <Text style={styles.optionLabel}>Classic</Text>
          <Text style={styles.optionDescription}>The default static look</Text>
        </View>
        {selected === null && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
      </TouchableOpacity>

      {BANNER_THEMES.map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[styles.optionRow, selected === t.key && styles.optionRowActive]}
          onPress={() => setSelected(t.key)}
        >
          <View style={[styles.optionSwatch, styles[`swatch_${t.key}` as const]]} />
          <View style={{ flex: 1 }}>
            <View style={styles.optionLabelRow}>
              <Text style={styles.optionLabel}>{t.label}</Text>
              {t.premium && (
                <LinearGradient
                  colors={['#7FE6FF', '#4DB7FF', '#6C3EFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.premiumPill}
                >
                  <Ionicons name="diamond" size={9} color="#fff" />
                  <Text style={styles.premiumPillText}>PREMIUM</Text>
                </LinearGradient>
              )}
            </View>
            <Text style={styles.optionDescription}>{t.description}</Text>
          </View>
          {selected === t.key && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>Save</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 60 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    previewWrap: { marginBottom: 24 },
    previewCard: {
      borderRadius: 22, padding: 24, alignItems: 'center',
      borderWidth: 1, borderColor: '#3a2c5c',
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
    },
    previewName: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 10 },
    previewHandle: { color: '#c9b8ea', fontSize: 13, fontWeight: '600', marginTop: 2 },
    sectionLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
    optionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: colors.surface, borderRadius: 16, padding: 14,
      marginBottom: 10, borderWidth: 1, borderColor: colors.borderMuted,
    },
    optionRowActive: { borderColor: colors.accent },
    optionSwatch: { width: 40, height: 40, borderRadius: 20 },
    optionSwatchClassic: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a0f2e', borderWidth: 1, borderColor: colors.accent },
    swatch_powersurge: { backgroundColor: '#FFB800' },
    swatch_turbo: { backgroundColor: '#2E9BFF' },
    swatch_nebula: { backgroundColor: '#6C3EFF' },
    swatch_dragonwrath: { backgroundColor: '#FF7A18' },
    swatch_monarch: { backgroundColor: '#8B5CF6' },
    optionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    premiumPill: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
    },
    premiumPillText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
    optionLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    optionDescription: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
    saveBtn: {
      backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 12,
      alignItems: 'center', marginTop: 12,
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
}
