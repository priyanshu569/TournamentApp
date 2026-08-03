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
    // Matches how the banner actually gets displayed: an exact match for
    // the home screen's compact card (220x90 = 22:9) and close to the
    // events list card's typical width/130 ratio too. 16:9 was noticeably
    // taller than either, so `contentFit: 'cover'` was silently cropping
    // the top/bottom of whatever the user composed in this crop step.
    aspect: [22, 9],
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
