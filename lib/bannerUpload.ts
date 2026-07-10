import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

// Returns the new public banner URL, or null if the user cancelled/denied permission.
export async function pickAndUploadBanner(userId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to set a banner image.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.7,
    base64: true,
  });

  if (result.canceled || !result.assets[0].base64) return null;

  const path = `${userId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('tournament-banners')
    .upload(path, decode(result.assets[0].base64), { contentType: 'image/jpeg' });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('tournament-banners').getPublicUrl(path);
  return data.publicUrl;
}
