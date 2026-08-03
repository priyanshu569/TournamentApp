import { decode } from 'base64-arraybuffer';
import { resizeAndCompress, RawImage } from './chatImage';
import { supabase } from './supabase';

// Takes an already-cropped image (from ImageCropPreview, locked to the 22:9
// banner ratio -- see create-tournament.tsx/edit-tournament.tsx) rather than
// driving the native picker itself. The native picker's own crop step was
// dropped entirely: on iOS, expo-image-picker's `allowsEditing` crop is
// always a square and ignores `aspect` (Android-only per Expo's docs), so
// there was no way to get a real wide-banner crop out of it.
export async function uploadBanner(userId: string, image: RawImage): Promise<string> {
  const { base64 } = await resizeAndCompress(image.uri, image.width, image.height);

  const path = `${userId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('tournament-banners')
    .upload(path, decode(base64), { contentType: 'image/jpeg' });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('tournament-banners').getPublicUrl(path);
  return data.publicUrl;
}
