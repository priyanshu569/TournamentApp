import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { resizeAndCompress, RawImage } from './chatImage';
import { supabase } from './supabase';

// Picks one or more product photos WITHOUT cropping -- each is then run
// through ImageCropPreview by the caller (admin-rewards.tsx) one at a
// time. The native picker's own crop can't be used here at all: it's
// mutually exclusive with allowsMultipleSelection, and it can't hold a
// consistent square across a batch, which is the whole point of a
// catalog gallery.
export async function pickRewardImages(limit: number): Promise<RawImage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to add reward photos.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 1,
  });

  if (result.canceled) return [];

  return result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

// Takes an already-cropped square (from ImageCropPreview, locked to
// REWARD_IMAGE_RATIO) and returns its public URL.
export async function uploadRewardImage(adminId: string, image: RawImage): Promise<string> {
  const { base64 } = await resizeAndCompress(image.uri, image.width, image.height);

  const path = `${adminId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('reward-images')
    .upload(path, decode(base64), { contentType: 'image/jpeg' });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('reward-images').getPublicUrl(path);
  return data.publicUrl;
}
