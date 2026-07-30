import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

// Chat images are transient/high-volume compared to a single profile
// photo, so a lower quality than avatarUpload.ts's 0.7 keeps typical
// uploads well under 1MB without a visible loss for a chat bubble.
const CHAT_IMAGE_QUALITY = 0.5;

export async function pickChatImage(source: 'camera' | 'library'): Promise<{ base64: string } | null> {
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

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: CHAT_IMAGE_QUALITY,
    base64: true,
  };

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets[0].base64) return null;
  return { base64: result.assets[0].base64 };
}

export async function uploadChatImage(
  conversationId: string,
  senderId: string,
  base64: string
): Promise<string> {
  const path = `${conversationId}/${senderId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from('chat-images')
    .upload(path, decode(base64), { contentType: 'image/jpeg' });

  if (error) throw error;
  return path;
}

export async function getSignedChatImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('chat-images')
    .createSignedUrl(path, 3600);

  if (error) throw error;
  return data.signedUrl;
}
