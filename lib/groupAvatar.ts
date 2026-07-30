import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

// Returns the new public group photo URL, or null if cancelled/denied.
// Storage RLS checks the path's leading folder against is_group_admin,
// so this only succeeds for an actual admin of that conversation.
export async function pickAndUploadGroupPhoto(conversationId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to set a group photo.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });

  if (result.canceled || !result.assets[0].base64) return null;

  const path = `${conversationId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('group-photos')
    .upload(path, decode(result.assets[0].base64), { contentType: 'image/jpeg' });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('group-photos').getPublicUrl(path);
  return data.publicUrl;
}
