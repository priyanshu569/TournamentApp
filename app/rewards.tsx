import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Image,
  TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { CoinAmount } from '@/components/FragCoin';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

export default function RewardsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [shippingName, setShippingName] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => { load(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData.user?.id;

    if (me) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('coins_balance')
        .eq('user_id', me)
        .maybeSingle();
      setBalance(wallet?.coins_balance ?? 0);
    }

    const { data } = await supabase
      .from('reward_catalog')
      .select('id, name, description, image_url, coin_cost, stock_quantity')
      .eq('is_active', true)
      .order('coin_cost', { ascending: true });
    setRewards(data ?? []);

    setLoading(false);
  }

  function openRedeemModal(reward: any) {
    setSelectedReward(reward);
    setShippingName('');
    setShippingAddress('');
    setShippingPhone('');
  }

  async function handleRedeem() {
    if (!selectedReward) return;

    if (!shippingName.trim() || !shippingAddress.trim() || !shippingPhone.trim()) {
      Alert.alert('Missing Details', 'Please fill in your name, address and phone number so this can be shipped to you.');
      return;
    }

    setRedeeming(true);
    const { error } = await supabase.rpc('redeem_reward', {
      p_reward_id: selectedReward.id,
      p_shipping_name: shippingName.trim(),
      p_shipping_address: shippingAddress.trim(),
      p_shipping_phone: shippingPhone.trim(),
    });
    setRedeeming(false);

    if (error) {
      Alert.alert('Could Not Redeem', error.message);
      return;
    }

    setSelectedReward(null);
    Alert.alert('Redeemed! 🎉', `${selectedReward.name} is on its way. Track it under My Redemptions.`, [
      { text: 'View My Redemptions', onPress: () => router.push('/my-redemptions') },
      { text: 'OK', style: 'cancel' },
    ]);
    load();
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
        <Text style={styles.headerTitle}>Redeem Rewards</Text>
        <View style={styles.balancePill}>
          <CoinAmount amount={balance} size={14} textStyle={styles.balancePillText} />
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
        data={rewards}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="gift-outline" size={32} color={colors.textDisabled} />
            <Text style={styles.emptyText}>No rewards available right now. Check back soon!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const affordable = balance >= item.coin_cost;
          const outOfStock = item.stock_quantity !== null && item.stock_quantity <= 0;
          const disabled = !affordable || outOfStock;

          return (
            <TouchableOpacity
              style={[styles.card, disabled && styles.cardDisabled]}
              onPress={() => openRedeemModal(item)}
              disabled={disabled}
              activeOpacity={0.85}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <View style={styles.cardImageFallback}>
                  <Ionicons name="gift" size={28} color={colors.textDisabled} />
                </View>
              )}
              <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              <CoinAmount amount={item.coin_cost} size={15} textStyle={styles.cardCost} />
              {outOfStock && <Text style={styles.cardStockOut}>Out of stock</Text>}
              {!outOfStock && !affordable && <Text style={styles.cardNeedMore}>Need {(item.coin_cost - balance).toLocaleString('en-IN')} more</Text>}
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={!!selectedReward} transparent animationType="slide" onRequestClose={() => setSelectedReward(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Redeem {selectedReward?.name}</Text>
              <TouchableOpacity onPress={() => setSelectedReward(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalCostRow}>
              <Text style={styles.modalCost}>This will cost</Text>
              <CoinAmount amount={selectedReward?.coin_cost ?? 0} size={15} textStyle={styles.modalCost} />
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Who should we address this to?"
              placeholderTextColor={colors.textDisabled}
              value={shippingName}
              onChangeText={setShippingName}
            />
            <Text style={styles.inputLabel}>Shipping Address</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Full address, including pincode"
              placeholderTextColor={colors.textDisabled}
              value={shippingAddress}
              onChangeText={setShippingAddress}
              multiline
            />
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="For delivery updates"
              placeholderTextColor={colors.textDisabled}
              keyboardType="phone-pad"
              value={shippingPhone}
              onChangeText={setShippingPhone}
            />

            <TouchableOpacity style={styles.confirmBtn} onPress={handleRedeem} disabled={redeeming}>
              {redeeming
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>Confirm Redemption</Text>
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
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, gap: 8,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, flex: 1 },
    balancePill: {
      backgroundColor: colors.accentMutedStrong, borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.accent,
    },
    balancePillText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
    listContent: { paddingHorizontal: 18, paddingBottom: 48 },
    row: { gap: 12 },
    emptyContainer: { alignItems: 'center', gap: 12, marginTop: 60, paddingHorizontal: 20, width: '100%' },
    emptyText: { color: colors.textFaint, textAlign: 'center' },
    card: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12,
      marginBottom: 12, borderWidth: 1, borderColor: colors.borderMuted,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    cardDisabled: { opacity: 0.5 },
    cardImage: { width: '100%', aspectRatio: 1, borderRadius: 10, marginBottom: 10, backgroundColor: colors.surfaceAlt },
    cardImageFallback: {
      width: '100%', aspectRatio: 1, borderRadius: 10, marginBottom: 10,
      backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center',
    },
    cardName: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 6, minHeight: 34 },
    cardCost: { color: colors.accent, fontSize: 14, fontWeight: '800' },
    cardStockOut: { color: colors.error, fontSize: 11, fontWeight: '700', marginTop: 4 },
    cardNeedMore: { color: colors.textFaint, fontSize: 11, fontWeight: '600', marginTop: 4 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
    modalCard: {
      backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 36, borderWidth: 1, borderColor: colors.border,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    modalTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800', flex: 1, marginRight: 12 },
    modalCostRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
    modalCost: { color: colors.accent, fontSize: 14, fontWeight: '700' },
    inputLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: '600' },
    input: {
      backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 14,
    },
    confirmBtn: {
      backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 12,
      alignItems: 'center', marginTop: 4,
    },
    confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  });
}
