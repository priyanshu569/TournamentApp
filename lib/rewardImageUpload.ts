import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

// Mirrors avatarUpload.ts's pattern (native allowsEditing crop, not the
// ImageCropPreview flow) -- reward cards are square everywhere they're
// shown (rewards.tsx, admin-rewards.tsx), and unlike the banner's wide
// ratio, iOS's native crop step handles a 1:1 aspect correctly.
export async function pickAndUploadRewardImage(adminId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to set a reward image.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });

  if (result.canceled || !result.assets[0].base64) return null;

  const path = `${adminId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('reward-images')
    .upload(path, decode(result.assets[0].base64), { contentType: 'image/jpeg' });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('reward-images').getPublicUrl(path);
  return data.publicUrl;
}
