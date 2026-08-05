import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { formatRelativeTime } from '@/lib/time';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  prize_won: { icon: 'trophy', color: '#FFB800' },
  redemption: { icon: 'gift', color: '#7C3AED' },
  admin_adjustment: { icon: 'construct', color: '#4FA3FF' },
};

export default function WalletScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
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

    const { data: wallet } = await supabase
      .from('wallets')
      .select('coins_balance')
      .eq('user_id', me)
      .maybeSingle();
    // No row yet just means this account has never won or spent a coin --
    // a real 0, not an error.
    setBalance(wallet?.coins_balance ?? 0);

    const { data: txns } = await supabase
      .from('coin_transactions')
      .select('id, amount, type, description, created_at')
      .eq('user_id', me)
      .order('created_at', { ascending: false })
      .limit(100);
    setTransactions(txns ?? []);

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
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
      data={transactions}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Wallet</Text>
            <View style={{ width: 36 }} />
          </View>

          <LinearGradient
            colors={['#241a3a', '#150f24']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <Text style={styles.balanceLabel}>FRAGCOINS BALANCE</Text>
            <Text style={styles.balanceValue}>🪙 {balance.toLocaleString('en-IN')}</Text>
            <TouchableOpacity style={styles.redeemBtn} onPress={() => router.push('/rewards')}>
              <Ionicons name="gift" size={16} color="#fff" />
              <Text style={styles.redeemBtnText}>Redeem for Rewards</Text>
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.historyHeaderRow}>
            <Text style={styles.sectionLabel}>HISTORY</Text>
            <TouchableOpacity onPress={() => router.push('/my-redemptions')}>
              <Text style={styles.myOrdersLink}>My Redemptions →</Text>
            </TouchableOpacity>
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={32} color={colors.textDisabled} />
          <Text style={styles.emptyText}>No FragCoins activity yet. Win a tournament to get started!</Text>
        </View>
      }
      renderItem={({ item }) => {
        const meta = TYPE_META[item.type] ?? { icon: 'ellipse', color: colors.textTertiary };
        const isCredit = item.amount > 0;
        return (
          <View style={styles.txnRow}>
            <View style={[styles.txnIconCircle, { backgroundColor: meta.color + '1c', borderColor: meta.color + '44' }]}>
              <Ionicons name={meta.icon} size={16} color={meta.color} />
            </View>
            <View style={styles.txnInfo}>
              <Text style={styles.txnDescription} numberOfLines={2}>{item.description}</Text>
              <Text style={styles.txnDate}>{formatRelativeTime(item.created_at)}</Text>
            </View>
            <Text style={[styles.txnAmount, { color: isCredit ? colors.success : colors.error }]}>
              {isCredit ? '+' : ''}{item.amount.toLocaleString('en-IN')}
            </Text>
          </View>
        );
      }}
    />
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    listContent: { paddingBottom: 48 },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    balanceCard: {
      alignItems: 'center', paddingVertical: 28,
      marginHorizontal: 24, borderRadius: 18, marginBottom: 20,
      borderWidth: 1, borderColor: '#2f2447',
    },
    balanceLabel: { color: '#c9b8ea', fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
    balanceValue: { color: '#fff', fontSize: 38, fontWeight: '900', marginBottom: 18 },
    redeemBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
    },
    redeemBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    historyHeaderRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginHorizontal: 24, marginBottom: 10,
    },
    sectionLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 1.2 },
    myOrdersLink: { color: colors.accent, fontSize: 12, fontWeight: '700' },
    emptyContainer: { alignItems: 'center', gap: 12, marginTop: 40, paddingHorizontal: 20 },
    emptyText: { color: colors.textFaint, textAlign: 'center' },
    txnRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 14, padding: 12,
      marginHorizontal: 24, marginBottom: 10, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    txnIconCircle: {
      width: 36, height: 36, borderRadius: 18,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1,
    },
    txnInfo: { flex: 1 },
    txnDescription: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
    txnDate: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
    txnAmount: { fontSize: 15, fontWeight: '800' },
  });
}
