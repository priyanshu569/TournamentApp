import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { notifyAndLog } from '@/lib/notifications';

export default function Payment() {
  const router = useRouter();
  const { amount, tournament_id, team_id, registration_id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [webViewKey, setWebViewKey] = useState(0);
  const [order, setOrder] = useState<{ order_id: string; amount: number; key_id: string } | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    createOrder();
  }, []);

  async function createOrder() {
    setLoading(true);
    setOrderError(null);
    const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
      body: { registration_id },
    });

    if (error || !data?.order_id) {
      setOrderError(data?.error || error?.message || 'Could not start payment. Please try again.');
      setLoading(false);
      return;
    }

    setOrder(data);
    setLoading(false);
  }

  const htmlContent = order ? `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <style>
        body {
          margin: 0;
          background: #0a0a0a;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-family: -apple-system, sans-serif;
        }
        .info {
          color: #aaa;
          font-size: 14px;
          text-align: center;
          padding: 20px;
        }
        .amount {
          color: #7C3AED;
          font-size: 32px;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .label {
          color: #555;
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <div class="info">
        <div class="label">Entry Fee</div>
        <div class="amount">₹${amount}</div>
        <div class="label">Opening payment...</div>
      </div>
      <script>
        var options = {
          key: '${order.key_id}',
          order_id: '${order.order_id}',
          amount: ${order.amount},
          currency: 'INR',
          name: 'Fragify',
          description: 'Tournament Entry Fee',
          theme: { color: '#7C3AED' },
          handler: function(response) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              success: true,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            }));
          },
          modal: {
            ondismiss: function() {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                success: false,
                reason: 'dismissed'
              }));
            }
          }
        };
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            success: false,
            reason: response.error.description
          }));
        });
        setTimeout(function() { rzp.open(); }, 500);
      </script>
    </body>
    </html>
  ` : '';

  const handleMessage = async (event: any) => {
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch (e) {
      return;
    }

    if (data.success) {
      setLoading(true);
      const { data: verifyResult, error } = await supabase.functions.invoke('verify-razorpay-payment', {
        body: {
          registration_id,
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
        },
      });
      setLoading(false);

      if (error || !verifyResult?.success) {
        Alert.alert(
          'Verification Failed',
          verifyResult?.error || error?.message || 'We could not verify your payment. If money was deducted, contact support.',
        );
        return;
      }

      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: profile } = await supabase
            .from('Profiles')
            .select('push_token, push_enabled')
            .eq('id', userData.user.id)
            .single();

          await notifyAndLog(
            userData.user.id,
            profile?.push_enabled ? profile?.push_token : null,
            '✅ Registration Confirmed',
            'Payment received! Your team is confirmed for the tournament.',
            tournament_id as string
          );
        }
      } catch (err) {
        console.log('Notify error:', err);
      }

      Alert.alert('Payment Successful! 🎉', 'Your team is confirmed for the tournament!', [
        { text: 'OK', onPress: () => router.push('/') }
      ]);
    } else {
      if (data.reason === 'dismissed') {
        Alert.alert(
          'Payment Cancelled',
          'You cancelled the payment. Want to try again?',
          [
            { text: 'Try Again', onPress: () => setWebViewKey(k => k + 1) },
            { text: 'Go Back', style: 'cancel', onPress: () => router.back() }
          ]
        );
      } else {
        Alert.alert('Payment Failed', data.reason, [
          { text: 'Try Again', onPress: () => setWebViewKey(k => k + 1) },
          { text: 'Go Back', style: 'cancel', onPress: () => router.back() }
        ]);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Amount Display */}
      <LinearGradient
        colors={['#241a3a', '#150f24']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.amountBox}
      >
        <Text style={styles.amountLabel}>ENTRY FEE</Text>
        <Text style={styles.amountValue}>₹{amount}</Text>
        <View style={styles.amountSubRow}>
          <Ionicons name="shield-checkmark" size={13} color="#00D4AA" />
          <Text style={styles.amountSub}>Secured by Razorpay</Text>
        </View>
      </LinearGradient>

      {orderError ? (
        <View style={styles.loadingOverlay}>
          <Text style={styles.errorText}>{orderError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={createOrder}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text style={styles.loadingText}>Opening payment...</Text>
            </View>
          )}

          {order && (
            <WebView
              key={webViewKey}
              source={{ html: htmlContent }}
              onMessage={handleMessage}
              onLoad={() => setLoading(false)}
              javaScriptEnabled
              style={styles.webview}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 24,
    paddingTop: 60, paddingBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  amountBox: {
    alignItems: 'center', paddingVertical: 28,
    marginHorizontal: 24, borderRadius: 18, marginBottom: 8,
    borderWidth: 1, borderColor: '#2f2447',
  },
  amountLabel: { color: '#888', fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  amountValue: { color: '#fff', fontSize: 42, fontWeight: '900', marginBottom: 8 },
  amountSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  amountSub: { color: '#00D4AA', fontSize: 12, fontWeight: '600' },
  webview: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    zIndex: 10,
    gap: 12,
  },
  loadingText: { color: '#aaa', fontSize: 14 },
  errorText: { color: '#FF4444', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    backgroundColor: '#7C3AED', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
  },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
