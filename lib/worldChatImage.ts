import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { resizeAndCompress, PickedChatImage } from './chatImage';

// World chat photos share the same resize/compress pass as DM chat
// images, but live in a public bucket with public URLs (no signing
// needed) since the whole feed is already public.
export async function pickWorldChatImage(source: 'camera' | 'library'): Promise<PickedChatImage | null> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Camera access is required to take a photo.'
        : 'Photo library access is required to choose a photo.'
    );
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled) return null;

  const asset = result.assets[0];
  return resizeAndCompress(asset.uri, asset.width, asset.height);
}

export async function uploadWorldChatImage(authorId: string, base64: string): Promise<string> {
  const path = `${authorId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from('world-chat-images')
    .upload(path, decode(base64), { contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('world-chat-images').getPublicUrl(path);
  return data.publicUrl;
}
