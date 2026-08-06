import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const SECTIONS = [
  {
    title: 'Acceptance of Terms',
    body:
      'By creating an account or using Fragify, you agree to these terms. If you don\'t agree, please don\'t use the app. Fragify is not intended for children under 13.',
  },
  {
    title: 'Your Account',
    body:
      'You\'re responsible for the activity on your account and for keeping the game IDs and other details you provide accurate. Don\'t impersonate another player, host, or admin, and don\'t create multiple accounts to get around registration limits, rate limits, or tournament rules.',
  },
  {
    title: 'Tournaments & Hosts',
    body:
      'Fragify is a platform that lets approved hosts run their own tournaments and scrims — Fragify doesn\'t organize the matches itself. Hosts set point rules, review results, and mark tournaments complete; their decisions on placements and results are final unless successfully disputed through in-app reporting or support. Tournament entry through the app is free.',
  },
  {
    title: 'FragCoins',
    body:
      'FragCoins are a virtual reward earned by placing in tournaments — they are not real currency, cannot be purchased, have no cash value, and cannot be transferred between accounts or cashed out. Fragify may change how many FragCoins a tournament awards, or what\'s available in the rewards catalog, at any time.',
  },
  {
    title: 'Reward Redemption & Shipping',
    body:
      'FragCoins can be redeemed for physical rewards shown in the app while supplies last. You\'re responsible for providing an accurate shipping name, address, and phone number — Fragify isn\'t responsible for delivery failures caused by incorrect details. Once coins are spent on a redemption, they\'re only refunded to your wallet if Fragify cancels that order.',
  },
  {
    title: 'Conduct',
    body:
      'Don\'t cheat, exploit bugs, harass or threaten other users, post illegal or abusive content, or use chat, world chat, or your profile to spam or scam other players. We can remove content, suspend, or terminate accounts that break these rules, with or without notice depending on severity.',
  },
  {
    title: 'Your Content',
    body:
      'You keep ownership of the photos, messages, and other content you post. By posting it in Fragify, you give us permission to store and display it back to the people it\'s shared with (a chat participant, a tournament host, etc.) so the app can function.',
  },
  {
    title: 'Disclaimer',
    body:
      'Fragify is provided "as is." We do our best to keep tournaments, results, and the wallet accurate, but we don\'t guarantee the app will always be available, error-free, or uninterrupted.',
  },
  {
    title: 'Changes to These Terms',
    body:
      'We may update these terms from time to time. Continued use of Fragify after a change means you accept the updated terms.',
  },
  {
    title: 'Governing Law',
    body:
      'These terms are governed by the laws of India.',
  },
];

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text style={styles.lastUpdated}>Last updated: August 2026</Text>

      <Text style={styles.intro}>
        These terms explain what you can expect from Fragify, and what we expect from you —
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
          Questions about these terms? Reach us at fragify.support@gmail.com or on
          WhatsApp at +91 78000 96706.
        </Text>
      </View>
    </ScrollView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 4,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
    lastUpdated: { color: colors.textFaint, fontSize: 12, marginBottom: 16 },
    intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 28 },
    section: { marginBottom: 24 },
    sectionTitle: { color: colors.accent, fontSize: 15, fontWeight: '800', marginBottom: 8 },
    sectionBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  });
}
