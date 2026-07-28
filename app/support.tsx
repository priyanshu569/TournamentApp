import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const SUPPORT_EMAIL = 'fragify.support@gmail.com';
const WHATSAPP_NUMBER = '917800096706'; // country code + number, no symbols

const FAQS = [
  {
    q: 'How do I join a tournament?',
    a: 'Go to the Events tab, pick a tournament, and tap Register. Add your team\'s squad details and complete payment (if there\'s an entry fee) to confirm your slot.',
  },
  {
    q: 'When will I get the room ID and password?',
    a: 'The host publishes the room code shortly before the match starts. You\'ll see it on the tournament details page once your registration is confirmed, and you\'ll also get a notification.',
  },
  {
    q: 'I paid the entry fee but my registration still shows pending. What do I do?',
    a: 'This usually resolves within a few minutes. If it doesn\'t, contact support with your payment reference and the tournament name so we can verify and confirm your slot.',
  },
  {
    q: 'Can I cancel my registration?',
    a: 'You can cancel a pending (unpaid) registration anytime from the History tab. Confirmed paid registrations currently can\'t be self-cancelled — contact support if you need help.',
  },
  {
    q: 'How do I become a verified host?',
    a: 'Host verification is currently granted by the Fragify team after a review. Contact support if you\'re hosting regularly and want a verified badge.',
  },
];

export default function SupportScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  function openEmail() {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Fragify Support Request`);
  }

  function openWhatsApp() {
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}`);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Contact Us */}
      <Text style={styles.sectionLabel}>CONTACT US</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.contactRow} onPress={openEmail}>
          <View style={[styles.contactIconBox, { backgroundColor: colors.accentMutedStrong }]}>
            <Ionicons name="mail" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>Email</Text>
            <Text style={styles.contactSub}>{SUPPORT_EMAIL}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.contactRow} onPress={openWhatsApp}>
          <View style={[styles.contactIconBox, { backgroundColor: '#25D36622' }]}>
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>WhatsApp</Text>
            <Text style={styles.contactSub}>+91 78000 96706</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </TouchableOpacity>
      </View>

      {/* FAQ */}
      <Text style={styles.sectionLabel}>FREQUENTLY ASKED QUESTIONS</Text>
      <View style={styles.card}>
        {FAQS.map((item, index) => {
          const isOpen = expandedIndex === index;
          return (
            <View key={index}>
              <TouchableOpacity
                style={styles.faqRow}
                onPress={() => setExpandedIndex(isOpen ? null : index)}
              >
                <Text style={styles.faqQuestion}>{item.q}</Text>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#777"
                />
              </TouchableOpacity>
              {isOpen && (
                <Text style={styles.faqAnswer}>{item.a}</Text>
              )}
              {index < FAQS.length - 1 && <View style={styles.divider} />}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 48 },
    header: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
    sectionLabel: {
      fontSize: 12, color: colors.textMuted, fontWeight: '700',
      marginHorizontal: 24, marginBottom: 8, marginTop: 16, letterSpacing: 1,
    },
    card: {
      backgroundColor: colors.surface, marginHorizontal: 24, borderRadius: 14,
      borderWidth: 1, borderColor: colors.borderMuted, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
    },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
    contactRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    },
    contactIconBox: {
      width: 40, height: 40, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center',
    },
    contactTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    contactSub: { color: colors.textTertiary, fontSize: 13, marginTop: 2 },
    faqRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    },
    faqQuestion: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    faqAnswer: {
      color: colors.textSecondary, fontSize: 13, lineHeight: 19,
      paddingHorizontal: 16, paddingBottom: 14,
    },
  });
}