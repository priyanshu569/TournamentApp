import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Image,
  TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Switch, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import FragCoin from '@/components/FragCoin';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const EMPTY_DRAFT = {
  id: null as string | null,
  name: '',
  description: '',
  image_url: '',
  coin_cost: '',
  stock_quantity: '',
  is_active: true,
};

export default function AdminRewardsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [draft, setDraft] = useState<typeof EMPTY_DRAFT | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function load() {
    const { data, error } = await supabase
      .from('reward_catalog')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Failed to load reward catalog:', error.message);
    } else {
      setRewards(data ?? []);
    }
    setLoading(false);
  }

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT });
  }

  function openEdit(reward: any) {
    setDraft({
      id: reward.id,
      name: reward.name,
      description: reward.description ?? '',
      image_url: reward.image_url ?? '',
      coin_cost: String(reward.coin_cost),
      stock_quantity: reward.stock_quantity != null ? String(reward.stock_quantity) : '',
      is_active: reward.is_active,
    });
  }

  async function handleSaveDraft() {
    if (!draft) return;

    const coinCost = parseInt(draft.coin_cost, 10);
    if (!draft.name.trim() || !coinCost || coinCost <= 0) {
      Alert.alert('Missing Fields', 'A name and a positive coin cost are required.');
      return;
    }

    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      image_url: draft.image_url.trim() || null,
      coin_cost: coinCost,
      stock_quantity: draft.stock_quantity.trim() ? parseInt(draft.stock_quantity, 10) : null,
      is_active: draft.is_active,
    };

    const { error } = draft.id
      ? await supabase.from('reward_catalog').update(payload).eq('id', draft.id)
      : await supabase.from('reward_catalog').insert(payload);

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setDraft(null);
    load();
  }

  function confirmToggleActive(reward: any) {
    Alert.alert(
      reward.is_active ? 'Deactivate Reward?' : 'Reactivate Reward?',
      reward.is_active
        ? `${reward.name} will no longer be visible to players in the rewards catalog.`
        : `${reward.name} will become visible and redeemable again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: reward.is_active ? 'Deactivate' : 'Reactivate', onPress: () => handleToggleActive(reward) },
      ]
    );
  }

  async function handleToggleActive(reward: any) {
    setSavingId(reward.id);
    const { error } = await supabase
      .from('reward_catalog')
      .update({ is_active: !reward.is_active })
      .eq('id', reward.id);
    setSavingId(null);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setRewards((prev) => prev.map((r) => (r.id === reward.id ? { ...r, is_active: !r.is_active } : r)));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Rewards</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
          data={rewards}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="gift-outline" size={32} color={colors.textDisabled} />
              <Text style={styles.emptyText}>No rewards yet. Tap + to add one.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.card, !item.is_active && styles.cardInactive]} onPress={() => openEdit(item)} activeOpacity={0.8}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={styles.cardImageFallback}>
                  <Ionicons name="gift" size={22} color={colors.textDisabled} />
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.cardMetaRow}>
                  <FragCoin size={12} />
                  <Text style={styles.cardMeta}>
                    {item.coin_cost.toLocaleString('en-IN')} · {item.stock_quantity != null ? `${item.stock_quantity} left` : 'Unlimited'}
                  </Text>
                </View>
                {!item.is_active && <Text style={styles.inactiveTag}>Inactive</Text>}
              </View>
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={() => confirmToggleActive(item)}
                disabled={savingId === item.id}
              >
                {savingId === item.id
                  ? <ActivityIndicator size="small" color={colors.accent} />
                  : <Ionicons name={item.is_active ? 'eye' : 'eye-off'} size={18} color={item.is_active ? colors.success : colors.textFaint} />
                }
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={!!draft} transparent animationType="slide" onRequestClose={() => setDraft(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{draft?.id ? 'Edit Reward' : 'New Reward'}</Text>
              <TouchableOpacity onPress={() => setDraft(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Fragify Hoodie"
              placeholderTextColor={colors.textDisabled}
              value={draft?.name}
              onChangeText={(v) => setDraft((prev) => prev && { ...prev, name: v })}
            />
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              placeholder="What is this? Sizes, colors, etc."
              placeholderTextColor={colors.textDisabled}
              value={draft?.description}
              onChangeText={(v) => setDraft((prev) => prev && { ...prev, description: v })}
              multiline
            />
            <Text style={styles.inputLabel}>Image URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={colors.textDisabled}
              value={draft?.image_url}
              onChangeText={(v) => setDraft((prev) => prev && { ...prev, image_url: v })}
              autoCapitalize="none"
            />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Coin Cost</Text>
                <TextInput
                  style={styles.input}
                  placeholder="500"
                  placeholderTextColor={colors.textDisabled}
                  keyboardType="numeric"
                  value={draft?.coin_cost}
                  onChangeText={(v) => setDraft((prev) => prev && { ...prev, coin_cost: v })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Stock (blank = ∞)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Unlimited"
                  placeholderTextColor={colors.textDisabled}
                  keyboardType="numeric"
                  value={draft?.stock_quantity}
                  onChangeText={(v) => setDraft((prev) => prev && { ...prev, stock_quantity: v })}
                />
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.inputLabel}>Visible to players</Text>
              <Switch
                value={draft?.is_active ?? true}
                onValueChange={(v) => setDraft((prev) => prev && { ...prev, is_active: v })}
                trackColor={{ false: colors.border, true: colors.accent }}
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDraft} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>{draft?.id ? 'Save Changes' : 'Create Reward'}</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    addBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent,
      justifyContent: 'center', alignItems: 'center',
    },
    listContent: { padding: 24, paddingTop: 0, paddingBottom: 48 },
    emptyContainer: { alignItems: 'center', gap: 12, marginTop: 60, paddingHorizontal: 20 },
    emptyText: { color: colors.textFaint, textAlign: 'center' },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 14, padding: 12,
      marginBottom: 10, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    cardInactive: { opacity: 0.55 },
    cardImage: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surfaceAlt },
    cardImageFallback: {
      width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    cardInfo: { flex: 1 },
    cardName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    cardMeta: { color: colors.textTertiary, fontSize: 12 },
    inactiveTag: { color: colors.error, fontSize: 11, fontWeight: '700', marginTop: 2 },
    toggleBtn: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
    modalCard: {
      backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 36, borderWidth: 1, borderColor: colors.border,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
    inputLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '600' },
    input: {
      backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 14,
    },
    row2: { flexDirection: 'row', gap: 12 },
    switchRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 20,
    },
    saveBtn: {
      backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 12,
      alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  });
}
