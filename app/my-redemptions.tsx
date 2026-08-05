import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { formatRelativeTime } from '@/lib/time';
import { CoinAmount } from '@/components/FragCoin';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const STATUS_META: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'Processing', color: '#FFB800', icon: 'time' },
  shipped: { label: 'Shipped', color: '#4FA3FF', icon: 'airplane' },
  fulfilled: { label: 'Delivered', color: '#00D4AA', icon: 'checkmark-circle' },
  cancelled: { label: 'Cancelled', color: '#FF4444', icon: 'close-circle' },
};

export default function MyRedemptionsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id;
    if (!me) { setLoading(false); return; }

    const { data } = await supabase
      .from('coin_redemptions')
      .select('id, reward_name, coin_cost, status, created_at, fulfilled_at')
      .eq('user_id', me)
      .order('created_at', { ascending: false });
    setRedemptions(data ?? []);

    setLoading(false);
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Redemptions</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
        data={redemptions}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={32} color={colors.textDisabled} />
            <Text style={styles.emptyText}>No redemptions yet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] ?? STATUS_META.pending;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.rewardName} numberOfLines={1}>{item.reward_name}</Text>
                <CoinAmount amount={item.coin_cost} size={14} textStyle={styles.rewardCost} />
              </View>
              <View style={styles.cardBottom}>
                <View style={[styles.statusBadge, { backgroundColor: meta.color + '1c', borderColor: meta.color + '44' }]}>
                  <Ionicons name={meta.icon} size={12} color={meta.color} />
                  <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Text style={styles.dateText}>{formatRelativeTime(item.created_at)}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    listContent: { padding: 24, paddingTop: 0, paddingBottom: 48 },
    emptyContainer: { alignItems: 'center', gap: 12, marginTop: 60, paddingHorizontal: 20 },
    emptyText: { color: colors.textFaint, textAlign: 'center' },
    card: {
      backgroundColor: colors.surface, borderRadius: 14, padding: 14,
      marginBottom: 10, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    rewardName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 10 },
    rewardCost: { color: colors.accent, fontSize: 13, fontWeight: '800' },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
    },
    statusText: { fontSize: 11, fontWeight: '800' },
    dateText: { color: colors.textFaint, fontSize: 11 },
  });
}
