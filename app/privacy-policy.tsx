import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const SECTIONS = [
  {
    title: 'Information We Collect',
    body:
      'Account info: your username and either a phone number or Google account email, depending on how you sign in.\n\n' +
      'Game IDs: your Free Fire and/or BGMI UID, which you provide voluntarily so hosts can verify your in-game identity.\n\n' +
      'Tournament activity: teams you create or join, registrations, match results, placements, and kills.\n\n' +
      'Payment info: entry fees are processed directly by Razorpay. Fragify does not receive or store your card, UPI, or bank details.\n\n' +
      'Device info: a push notification token, used to send you tournament updates.',
  },
  {
    title: 'How We Use Your Information',
    body:
      'To run tournaments and scrims, verify game identities, process entry fee payments, show leaderboards and standings, send you notifications about registrations, room codes, and results, and review host access requests.',
  },
  {
    title: 'Third-Party Services',
    body:
      'Fragify relies on: Supabase (database, authentication, and file storage), Google (Sign in with Google), Razorpay (payment processing), and Expo\'s push notification service (delivering notifications to your device). Each of these providers processes data under their own privacy policies.',
  },
  {
    title: 'Data Sharing',
    body:
      'When you register for a tournament, the host can see your username, game UID, and registration status. We do not sell your personal data to third parties.',
  },
  {
    title: 'Data Retention & Account Deletion',
    body:
      'You can delete your account anytime from Settings → Delete Account. This removes your username, game UIDs, phone number, and login credentials. Some tournament history (for example, that a team placed 2nd in a match) stays on record in anonymized form, so it doesn\'t affect other players\' or hosts\' results.',
  },
  {
    title: 'Children\'s Privacy',
    body:
      'Fragify is not intended for children under 13, and we do not knowingly collect information from children under 13.',
  },
  {
    title: 'Your Rights',
    body:
      'You can access, correct, or delete your personal information at any time using the tools in Settings, or by contacting support below.',
  },
  {
    title: 'Security',
    body:
      'We use industry-standard practices, including row-level access controls and encrypted connections, to protect your data. No method of transmission or storage is 100% secure.',
  },
  {
    title: 'Changes to This Policy',
    body:
      'We may update this policy from time to time. Continued use of Fragify after a change means you accept the updated policy.',
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 26 }} />
      </View>

      <Text style={styles.lastUpdated}>Last updated: July 2026</Text>

      <Text style={styles.intro}>
        This policy explains what information Fragify collects, how it's used, and your choices —
        in plain language, not legalese.
      </Text>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <Text style={styles.sectionBody}>
          Questions about this policy or your data? Reach us at fragify.support@gmail.com or on
          WhatsApp at +91 78000 96706.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  lastUpdated: { color: '#555', fontSize: 12, marginBottom: 16 },
  intro: { color: '#aaa', fontSize: 14, lineHeight: 21, marginBottom: 28 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#7C3AED', fontSize: 15, fontWeight: '800', marginBottom: 8 },
  sectionBody: { color: '#ccc', fontSize: 14, lineHeight: 22 },
});
