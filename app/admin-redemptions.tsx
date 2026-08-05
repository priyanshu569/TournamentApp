import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { formatRelativeTime } from '@/lib/time';
import { CoinAmount } from '@/components/FragCoin';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const FILTERS = ['pending', 'shipped', 'fulfilled', 'cancelled'] as const;
type Filter = typeof FILTERS[number];

export default function AdminRedemptionsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => { load(); }, [filter]);

  async function onRefresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  async function load(silent = false) {
    if (!silent) setLoading(true);

    const { data, error } = await supabase
      .from('coin_redemptions')
      .select('*, requester:public_profiles!user_id(display_name, username)')
      .eq('status', filter)
      .order('created_at', { ascending: true });

    if (error) {
      console.log('Failed to load redemptions:', error.message);
    } else {
      setRedemptions(data ?? []);
    }
    setLoading(false);
  }

  async function markStatus(item: any, status: 'shipped' | 'fulfilled') {
    setActingId(item.id);
    const { error } = await supabase
      .from('coin_redemptions')
      .update({ status, fulfilled_at: status === 'fulfilled' ? new Date().toISOString() : null })
      .eq('id', item.id);
    setActingId(null);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setRedemptions((prev) => prev.filter((r) => r.id !== item.id));
  }

  function confirmCancel(item: any) {
    Alert.alert(
      'Cancel & Refund?',
      `${item.coin_cost.toLocaleString('en-IN')} FragCoins will be credited back to ${item.requester?.display_name ?? 'this player'}'s wallet.`,
      [
        { text: 'Keep It', style: 'cancel' },
        { text: 'Cancel & Refund', style: 'destructive', onPress: () => handleCancel(item) },
      ]
    );
  }

  async function handleCancel(item: any) {
    setActingId(item.id);
    const { error } = await supabase.rpc('admin_cancel_redemption', { p_redemption_id: item.id });
    setActingId(null);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setRedemptions((prev) => prev.filter((r) => r.id !== item.id));
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.heading}>🎁 Redemptions</Text>
      <Text style={styles.sub}>Fulfill FragCoin reward orders.</Text>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
          data={redemptions}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={32} color={colors.textDisabled} />
              <Text style={styles.emptyText}>No {filter} redemptions.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.rewardName} numberOfLines={1}>{item.reward_name}</Text>
                <CoinAmount amount={item.coin_cost} size={14} textStyle={styles.rewardCost} />
              </View>
              <Text style={styles.requesterText}>
                For {item.requester?.display_name ?? 'Unknown'}{item.requester?.username ? ` (@${item.requester.username})` : ''}
              </Text>
              <View style={styles.shippingBox}>
                <Text style={styles.shippingLine}>{item.shipping_name} · {item.shipping_phone}</Text>
                <Text style={styles.shippingLine}>{item.shipping_address}</Text>
              </View>
              <Text style={styles.dateText}>Requested {formatRelativeTime(item.created_at)}</Text>

              <View style={styles.actionsRow}>
                {filter === 'pending' && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => markStatus(item, 'shipped')}
                    disabled={actingId === item.id}
                  >
                    <Text style={styles.actionBtnText}>Mark Shipped</Text>
                  </TouchableOpacity>
                )}
                {filter === 'shipped' && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => markStatus(item, 'fulfilled')}
                    disabled={actingId === item.id}
                  >
                    <Text style={styles.actionBtnText}>Mark Delivered</Text>
                  </TouchableOpacity>
                )}
                {(filter === 'pending' || filter === 'shipped') && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => confirmCancel(item)}
                    disabled={actingId === item.id}
                  >
                    {actingId === item.id
                      ? <ActivityIndicator size="small" color={colors.error} />
                      : <Text style={styles.cancelBtnText}>Cancel & Refund</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: 24 },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    heading: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, marginBottom: 4 },
    sub: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
    filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    filterChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
    filterChipTextActive: { color: '#fff' },
    listContent: { paddingBottom: 48 },
    emptyContainer: { alignItems: 'center', gap: 12, marginTop: 40 },
    emptyText: { color: colors.textFaint, textAlign: 'center' },
    card: {
      backgroundColor: colors.surface, borderRadius: 14, padding: 14,
      marginBottom: 12, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    rewardName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 10 },
    rewardCost: { color: colors.accent, fontSize: 13, fontWeight: '800' },
    requesterText: { color: colors.textTertiary, fontSize: 12, marginBottom: 8 },
    shippingBox: {
      backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 10,
      borderWidth: 1, borderColor: colors.border, marginBottom: 8,
    },
    shippingLine: { color: colors.textSecondary, fontSize: 12, marginBottom: 2 },
    dateText: { color: colors.textFaint, fontSize: 11, marginBottom: 10 },
    actionsRow: { flexDirection: 'row', gap: 10 },
    actionBtn: {
      flex: 1, backgroundColor: colors.accent, paddingVertical: 11,
      borderRadius: 10, alignItems: 'center',
    },
    actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    cancelBtn: {
      flex: 1, backgroundColor: colors.errorMuted, paddingVertical: 11,
      borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.error + '55',
    },
    cancelBtnText: { color: colors.error, fontSize: 13, fontWeight: '700' },
  });
}
