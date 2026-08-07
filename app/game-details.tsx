import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import GameLogo from '@/components/GameLogo';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const GAMES: { name: string; color: string }[] = [
  { name: 'Free Fire', color: '#FF6B35' },
  { name: 'BGMI', color: '#FFB800' },
  { name: 'COD Mobile', color: '#00D4AA' },
  { name: 'Valorant', color: '#FF4655' },
];

type GameEntry = { in_game_name: string; game_uid: string };

export default function GameDetailsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [entries, setEntries] = useState<Record<string, GameEntry>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadExisting();
  }, []);

  async function loadExisting() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setFetching(false); return; }

    const { data } = await supabase
      .from('game_profiles')
      .select('game, in_game_name, game_uid')
      .eq('user_id', userData.user.id);

    if (data) {
      const nextEntries: Record<string, GameEntry> = {};
      const nextExpanded: Record<string, boolean> = {};
      for (const row of data) {
        nextEntries[row.game] = { in_game_name: row.in_game_name, game_uid: row.game_uid };
        nextExpanded[row.game] = true;
      }
      setEntries(nextEntries);
      setExpanded(nextExpanded);
    }
    setFetching(false);
  }

  function toggleGame(game: string) {
    setExpanded((prev) => ({ ...prev, [game]: !prev[game] }));
    if (!entries[game]) {
      setEntries((prev) => ({ ...prev, [game]: { in_game_name: '', game_uid: '' } }));
    }
  }

  function updateEntry(game: string, field: keyof GameEntry, value: string) {
    setEntries((prev) => ({ ...prev, [game]: { ...prev[game], [field]: value } }));
  }

  async function goNext() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  async function markOnboarded(userId: string) {
    await supabase.from('Profiles').update({ games_onboarded: true }).eq('id', userId);
  }

  async function handleSave() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    const rows = Object.entries(entries)
      .filter(([game, e]) => expanded[game] && e.in_game_name.trim() && e.game_uid.trim())
      .map(([game, e]) => ({
        user_id: user.id,
        game,
        in_game_name: e.in_game_name.trim(),
        game_uid: e.game_uid.trim(),
      }));

    setSaving(true);

    if (rows.length > 0) {
      const { error } = await supabase
        .from('game_profiles')
        .upsert(rows, { onConflict: 'user_id,game' });

      if (error) {
        setSaving(false);
        Alert.alert('Error', error.message);
        return;
      }
    }

    await markOnboarded(user.id);
    setSaving(false);
    goNext();
  }

  async function handleSkip() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await markOnboarded(userData.user.id);
    }
    goNext();
  }

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {router.canGoBack() && (
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      <Text style={styles.title}>Add Your Game Details</Text>
      <Text style={styles.subtitle}>
        Select the games you play and add your in-game name and UID so hosts can verify you.
      </Text>

      {GAMES.map((game) => {
        const isExpanded = !!expanded[game.name];
        const entry = entries[game.name] ?? { in_game_name: '', game_uid: '' };

        return (
          <View key={game.name} style={styles.gameCard}>
            <TouchableOpacity style={styles.gameHeader} onPress={() => toggleGame(game.name)}>
              <GameLogo game={game.name} size={40} style={styles.gameLogo} />
              <Text style={styles.gameName}>{game.name}</Text>
              <Ionicons
                name={isExpanded ? 'checkmark-circle' : 'add-circle-outline'}
                size={24}
                color={isExpanded ? colors.success : colors.textFaint}
              />
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.gameFields}>
                <TextInput
                  style={styles.input}
                  placeholder="In-Game Name"
                  placeholderTextColor={colors.textDisabled}
                  value={entry.in_game_name}
                  onChangeText={(v) => updateEntry(game.name, 'in_game_name', v)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Game UID"
                  placeholderTextColor={colors.textDisabled}
                  value={entry.game_uid}
                  onChangeText={(v) => updateEntry(game.name, 'game_uid', v)}
                  keyboardType="number-pad"
                />
              </View>
            )}
          </View>
        );
      })}

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Save & Continue 🚀</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={saving}>
        <Text style={styles.skipBtnText}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    },
    title: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, marginBottom: 8 },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 28, lineHeight: 20 },
    gameCard: {
      backgroundColor: colors.surface, borderRadius: 14, marginBottom: 14,
      borderWidth: 1, borderColor: colors.borderMuted, overflow: 'hidden',
    },
    gameHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    },
    gameLogo: {
      width: 40, height: 40, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center',
    },
    gameName: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    gameFields: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
    input: {
      backgroundColor: colors.background, color: colors.textPrimary, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
      borderWidth: 1, borderColor: colors.border,
    },
    button: {
      backgroundColor: colors.accent, paddingVertical: 16,
      borderRadius: 12, alignItems: 'center', marginTop: 8,
      shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
    },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    skipBtn: { alignItems: 'center', marginTop: 16, padding: 8 },
    skipBtnText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  });
}
