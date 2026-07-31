import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RawImage, cropImageToRatio } from '@/lib/chatImage';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const RATIOS: { key: string; label: string; value: number | null }[] = [
  { key: 'original', label: 'Original', value: null },
  { key: 'square', label: '1:1', value: 1 },
  { key: 'portrait', label: '4:5', value: 4 / 5 },
  { key: 'landscape', label: '16:9', value: 16 / 9 },
];

type Props = {
  visible: boolean;
  image: RawImage | null;
  onCancel: () => void;
  onConfirm: (image: RawImage) => void;
};

// Shown after picking a photo, before sending it (chat DMs and World
// Chat both use this). Cropping is always a centered crop to a chosen
// ratio -- no drag-to-reposition, just pick a ratio and see the result.
export default function ImageCropPreview({ visible, image, onCancel, onConfirm }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [activeRatio, setActiveRatio] = useState('original');
  const [current, setCurrent] = useState<RawImage | null>(image);
  const [cropping, setCropping] = useState(false);

  useEffect(() => {
    setCurrent(image);
    setActiveRatio('original');
  }, [image?.uri]);

  async function handleRatio(key: string, value: number | null) {
    if (!image || cropping) return;
    setActiveRatio(key);
    setCropping(true);
    try {
      setCurrent(await cropImageToRatio(image, value));
    } catch {
      setCurrent(image);
    }
    setCropping(false);
  }

  if (!image) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Edit Photo</Text>
            <View style={styles.headerBtn} />
          </View>

          <View style={styles.previewBox}>
            {current && (
              <Image
                source={{ uri: current.uri }}
                style={[styles.previewImage, { aspectRatio: current.width / current.height }]}
                resizeMode="cover"
              />
            )}
            {cropping && (
              <View style={styles.croppingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </View>

          <View style={styles.ratioRow}>
            {RATIOS.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.ratioChip, activeRatio === r.key && styles.ratioChipActive]}
                onPress={() => handleRatio(r.key, r.value)}
                disabled={cropping}
              >
                <Text style={[styles.ratioChipText, activeRatio === r.key && styles.ratioChipTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => current && onConfirm(current)}
            disabled={cropping || !current}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.confirmBtnText}>Use Photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 },
    card: {
      backgroundColor: colors.surface, borderRadius: 20, padding: 16,
      borderWidth: 1, borderColor: colors.border,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    headerBtn: { width: 60 },
    cancelText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    title: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
    previewBox: {
      width: '100%', borderRadius: 14, overflow: 'hidden',
      backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center',
      maxHeight: 400,
    },
    previewImage: { width: '100%' },
    croppingOverlay: {
      ...StyleSheet.absoluteFillObject, backgroundColor: '#00000055',
      justifyContent: 'center', alignItems: 'center',
    },
    ratioRow: { flexDirection: 'row', gap: 8, marginTop: 14, justifyContent: 'center' },
    ratioChip: {
      paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18,
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    ratioChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    ratioChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    ratioChipTextActive: { color: '#fff' },
    confirmBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 12, marginTop: 16,
    },
    confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  });
}
