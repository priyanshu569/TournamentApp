import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

// Replacing a group photo previously just left the old file in storage
// forever -- extracts the bucket-relative path from a public URL so the
// old file can be cleaned up once the new one is safely uploaded.
function pathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

// Returns the new public group photo URL, or null if cancelled/denied.
// Storage RLS checks the path's leading folder against is_group_admin,
// so this only succeeds for an actual admin of that conversation.
// `previousUrl`, if given, is deleted from storage after the new upload succeeds.
export async function pickAndUploadGroupPhoto(conversationId: string, previousUrl?: string | null): Promise<string | null> {
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

  if (previousUrl) {
    const oldPath = pathFromPublicUrl(previousUrl, 'group-photos');
    if (oldPath) supabase.storage.from('group-photos').remove([oldPath]).catch(() => {});
  }

  const { data } = supabase.storage.from('group-photos').getPublicUrl(path);
  return data.publicUrl;
}
