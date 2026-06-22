import { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function Payment() {
  const router = useRouter();
  const { amount, tournament_id, team_id, registration_id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);

  const RAZORPAY_KEY = 'rzp_test_T4niiB2H7e9SDl';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    </head>
    <body style="margin:0; background:#0a0a0a; display:flex; justify-content:center; align-items:center; height:100vh;">
      <script>
        var options = {
          key: '${RAZORPAY_KEY}',
          amount: ${Number(amount) * 100},
          currency: 'INR',
          name: 'Priyanshu Yadav',
          description: 'Tournament Entry Fee',
          theme: { color: '#7C3AED' },
          handler: function(response) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              success: true,
              payment_id: response.razorpay_payment_id
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
        rzp.open();
      </script>
    </body>
    </html>
  `;

  const handleMessage = async (event: any) => {
    console.log('Raw message:', event.nativeEvent.data);
    
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch (e) {
      console.log('Parse error:', e);
      return;
    }

    console.log('Parsed data:', JSON.stringify(data));
    console.log('Registration ID:', registration_id);

    if (data.success) {
      const { error } = await supabase
        .from('registrations')
        .update({ status: 'confirmed' })
        .eq('id', registration_id);

      console.log('Update error:', JSON.stringify(error));

      if (error) {
        Alert.alert('Error', 'Payment done but status update failed: ' + error.message);
      } else {
        Alert.alert('Payment Successful! 🎉', 'Your team is confirmed for the tournament!', [
          { text: 'OK', onPress: () => router.push('/') }
        ]);
      }
    } else {
      Alert.alert(
        'Payment Failed',
        data.reason === 'dismissed' ? 'Payment was cancelled.' : data.reason,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      )}
      <WebView
        source={{ html: htmlContent }}
        onMessage={handleMessage}
        onLoad={() => setLoading(false)}
        javaScriptEnabled
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    zIndex: 10,
  },
});