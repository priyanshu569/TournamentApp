import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { resizeAndCompress } from './chatImage';
import { supabase } from './supabase';

// An avatar is never shown larger than ~96px anywhere in the app (even
// at 3x DPI that's under 300px), so there's no reason to ship the
// uncapped original -- just resolution-compressed at quality 0.7 -- that
// this used to upload. Routed through the same resizeAndCompress the
// chat/banner/reward pipelines already use, just with a much smaller cap
// than their 1600px, since none of them are ever displayed that large.
const AVATAR_MAX_DIMENSION = 512;

// Replacing an avatar previously just left the old file in storage forever
// -- extracts the bucket-relative path from a public URL so the old file
// can be cleaned up once the new one is safely uploaded.
function pathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

// Returns the new public avatar photo URL, or null if the user cancelled/denied permission.
// `previousUrl`, if given, is deleted from storage after the new upload succeeds.
export async function pickAndUploadAvatarPhoto(userId: string, previousUrl?: string | null): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to set a profile photo.');
  }

  // quality: 1 here -- resizing + compressing happens once, below, via
  // resizeAndCompress. Compressing twice would just stack JPEG artifacts
  // for no benefit, same reasoning as pickRawChatImage.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  const { base64 } = await resizeAndCompress(asset.uri, asset.width, asset.height, AVATAR_MAX_DIMENSION);

  const path = `${userId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(path, decode(base64), { contentType: 'image/jpeg' });

  if (uploadError) throw uploadError;

  if (previousUrl) {
    const oldPath = pathFromPublicUrl(previousUrl, 'profile-photos');
    if (oldPath) supabase.storage.from('profile-photos').remove([oldPath]).catch(() => {});
  }

  const { data } = supabase.storage.from('profile-photos').getPublicUrl(path);
  return data.publicUrl;
}
