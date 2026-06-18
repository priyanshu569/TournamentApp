import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function VerifyOtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  async function verifyOtp() {
    if (otp.length !== 6) {
      Alert.alert('Invalid code', 'Please enter the 6-digit code');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone,
      token: otp,
      type: 'sms',
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Logged in successfully!');
      router.replace('/profile');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your number</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {phone}</Text>

      <TextInput
        style={styles.input}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        value={otp}
        onChangeText={setOtp}
      />

      <TouchableOpacity style={styles.button} onPress={verifyOtp} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify & Continue'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 32, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, fontSize: 24, textAlign: 'center', letterSpacing: 8, paddingVertical: 16, marginBottom: 20 },
  button: { backgroundColor: '#534AB7', paddingVertical: 16, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});