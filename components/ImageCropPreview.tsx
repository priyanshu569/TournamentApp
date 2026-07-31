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
const MAX_ZOOM = 4;

const RATIOS = [
  { key: 'original', label: 'Original' },
  { key: 'square', label: '1:1' },
  { key: '3:4', label: '3:4' },
  { key: '4:3', label: '4:3' },
  { key: '9:16', label: '9:16' },
  { key: '16:9', label: '16:9' },
];

function ratioValue(key: string, image: RawImage): number {
  switch (key) {
    case 'square': return 1;
    case '3:4': return 3 / 4;
    case '4:3': return 4 / 3;
    case '9:16': return 9 / 16;
    case '16:9': return 16 / 9;
    default: return image.width / image.height;
  }
}

type Props = {
  visible: boolean;
  image: RawImage | null;
  onCancel: () => void;
  onConfirm: (image: RawImage) => void;
};

// Instagram-style crop: the image pans/zooms freely under a FIXED frame
// (the frame's size is derived from the chosen ratio) instead of the
// frame moving over a fixed image -- whatever's visible inside the
// frame at any moment is exactly what gets cropped, so there's no
// separate preview/confirm mismatch. Scale is applied before translate
// in the transform chain specifically so translateX/Y always represent
// raw on-screen pixel offsets, matching how the pan/crop math below is
// derived -- reversing that order would mean translate gets scaled too,
// throwing off both the clamp bounds and the final crop rect.
export default function ImageCropPreview({ visible, image, onCancel, onConfirm }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [activeRatioKey, setActiveRatioKey] = useState('original');
  const [processing, setProcessing] = useState(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);

  useEffect(() => {
    setActiveRatioKey('original');
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
  }, [image?.uri]);

  useEffect(() => {
    translateX.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [activeRatioKey]);

  const imageAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
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

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      const totalW = dispW * scale.value;
      const totalH = dispH * scale.value;
      const maxX = Math.max(0, (totalW - frameWidth) / 2);
      const maxY = Math.max(0, (totalH - frameHeight) / 2);
      translateX.value = Math.max(-maxX, Math.min(maxX, startX.value + e.translationX));
      translateY.value = Math.max(-maxY, Math.min(maxY, startY.value + e.translationY));
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = Math.min(MAX_ZOOM, Math.max(1, startScale.value * e.scale));
      scale.value = next;

      const totalW = dispW * next;
      const totalH = dispH * next;
      const maxX = Math.max(0, (totalW - frameWidth) / 2);
      const maxY = Math.max(0, (totalH - frameHeight) / 2);
      translateX.value = Math.max(-maxX, Math.min(maxX, translateX.value));
      translateY.value = Math.max(-maxY, Math.min(maxY, translateY.value));
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  async function handleConfirm() {
    setProcessing(true);
    try {
      const totalScale = baseScale * scale.value;
      const cropWidth = frameWidth / totalScale;
      const cropHeight = frameHeight / totalScale;
      let originX = (image!.width - cropWidth) / 2 - translateX.value / totalScale;
      let originY = (image!.height - cropHeight) / 2 - translateY.value / totalScale;
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
              <GestureDetector gesture={composedGesture}>
                <Animated.View style={[{ width: dispW, height: dispH }, imageAnimStyle]}>
                  <Image source={{ uri: image.uri }} style={{ width: dispW, height: dispH }} resizeMode="cover" />
                </Animated.View>
              </GestureDetector>
            </View>
            <Text style={styles.dragHint}>Pinch to zoom, drag to reposition</Text>

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
