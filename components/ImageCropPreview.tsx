import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { RawImage, cropImageToRect } from '@/lib/chatImage';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const WINDOW_WIDTH = Dimensions.get('window').width;
const FRAME_MAX_WIDTH = Math.min(WINDOW_WIDTH - 64, 320);
const FRAME_MAX_HEIGHT = 380;

const RATIOS = [
  { key: 'original', label: 'Original' },
  { key: 'square', label: '1:1' },
  { key: '3:4', label: '3:4' },
  { key: '4:3', label: '4:3' },
  { key: '9:16', label: '9:16' },
];

function ratioValue(key: string, image: RawImage): number {
  switch (key) {
    case 'square': return 1;
    case '3:4': return 3 / 4;
    case '4:3': return 4 / 3;
    case '9:16': return 9 / 16;
    default: return image.width / image.height;
  }
}

type Props = {
  visible: boolean;
  image: RawImage | null;
  onCancel: () => void;
  onConfirm: (image: RawImage) => void;
};

// Instagram-style crop: the image pans freely under a FIXED frame (the
// frame's size is derived from the chosen ratio) instead of the frame
// moving over a fixed image -- whatever's visible inside the frame at
// any moment is exactly what gets cropped, so there's no separate
// preview/confirm mismatch. Pan-to-reposition only, no pinch-to-zoom --
// the image is always displayed at the minimum "cover" scale for the
// current frame, so there's never a gap at the edges.
export default function ImageCropPreview({ visible, image, onCancel, onConfirm }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [activeRatioKey, setActiveRatioKey] = useState('original');
  const [processing, setProcessing] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    setActiveRatioKey('original');
    translateX.value = 0;
    translateY.value = 0;
  }, [image?.uri]);

  useEffect(() => {
    translateX.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [activeRatioKey]);

  const imageAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  if (!image) return null;

  const ratio = ratioValue(activeRatioKey, image);
  let frameWidth = FRAME_MAX_WIDTH;
  let frameHeight = frameWidth / ratio;
  if (frameHeight > FRAME_MAX_HEIGHT) {
    frameHeight = FRAME_MAX_HEIGHT;
    frameWidth = frameHeight * ratio;
  }

  const baseScale = Math.max(frameWidth / image.width, frameHeight / image.height);
  const dispW = image.width * baseScale;
  const dispH = image.height * baseScale;
  const maxTranslateX = Math.max(0, (dispW - frameWidth) / 2);
  const maxTranslateY = Math.max(0, (dispH - frameHeight) / 2);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = Math.max(-maxTranslateX, Math.min(maxTranslateX, startX.value + e.translationX));
      translateY.value = Math.max(-maxTranslateY, Math.min(maxTranslateY, startY.value + e.translationY));
    });

  async function handleConfirm() {
    setProcessing(true);
    try {
      const cropWidth = frameWidth / baseScale;
      const cropHeight = frameHeight / baseScale;
      let originX = (image!.width - cropWidth) / 2 - translateX.value / baseScale;
      let originY = (image!.height - cropHeight) / 2 - translateY.value / baseScale;
      originX = Math.max(0, Math.min(originX, image!.width - cropWidth));
      originY = Math.max(0, Math.min(originY, image!.height - cropHeight));

      const cropped = await cropImageToRect(image!.uri, { originX, originY, width: cropWidth, height: cropHeight });
      setProcessing(false);
      onConfirm(cropped);
    } catch (err: any) {
      setProcessing(false);
      Alert.alert('Could not crop photo', err?.message ?? 'Please try again.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Edit Photo</Text>
              <View style={styles.headerBtn} />
            </View>

            <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
              <GestureDetector gesture={panGesture}>
                <Animated.View style={[{ width: dispW, height: dispH }, imageAnimStyle]}>
                  <Image source={{ uri: image.uri }} style={{ width: dispW, height: dispH }} resizeMode="cover" />
                </Animated.View>
              </GestureDetector>
            </View>
            <Text style={styles.dragHint}>Drag to reposition</Text>

            <View style={styles.ratioRow}>
              {RATIOS.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.ratioChip, activeRatioKey === r.key && styles.ratioChipActive]}
                  onPress={() => setActiveRatioKey(r.key)}
                >
                  <Text style={[styles.ratioChipText, activeRatioKey === r.key && styles.ratioChipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={processing}>
              {processing
                ? <ActivityIndicator color="#fff" />
                : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.confirmBtnText}>Use Photo</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 },
    card: {
      backgroundColor: colors.surface, borderRadius: 20, padding: 16,
      borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, width: '100%' },
    headerBtn: { width: 60 },
    cancelText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    title: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
    frame: {
      borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surfaceAlt,
      borderWidth: 1, borderColor: colors.border,
    },
    dragHint: { color: colors.textFaint, fontSize: 11, fontWeight: '600', marginTop: 8 },
    ratioRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' },
    ratioChip: {
      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18,
      backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    },
    ratioChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    ratioChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    ratioChipTextActive: { color: '#fff' },
    confirmBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.accent, paddingVertical: 14, borderRadius: 12, marginTop: 16, width: '100%',
    },
    confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  });
}
