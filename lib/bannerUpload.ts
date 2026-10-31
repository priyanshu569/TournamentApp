import { decode } from 'base64-arraybuffer';
import { resizeAndCompress, RawImage } from './chatImage';
import { supabase } from './supabase';

// Replacing a banner previously just left the old file in storage forever
// -- extracts the bucket-relative path from a public URL so the old file
// can be cleaned up once the new one is safely uploaded.
function pathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

// Takes an already-cropped image (from ImageCropPreview, locked to the 22:9
// banner ratio -- see create-tournament.tsx/edit-tournament.tsx) rather than
// driving the native picker itself. The native picker's own crop step was
// dropped entirely: on iOS, expo-image-picker's `allowsEditing` crop is
// always a square and ignores `aspect` (Android-only per Expo's docs), so
// there was no way to get a real wide-banner crop out of it.
// `previousUrl`, if given, is deleted from storage after the new upload succeeds.
export async function uploadBanner(userId: string, image: RawImage, previousUrl?: string | null): Promise<string> {
  const { base64 } = await resizeAndCompress(image.uri, image.width, image.height);

  const path = `${userId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('tournament-banners')
    .upload(path, decode(base64), { contentType: 'image/jpeg' });

  if (uploadError) throw uploadError;

  if (previousUrl) {
    const oldPath = pathFromPublicUrl(previousUrl, 'tournament-banners');
    if (oldPath) supabase.storage.from('tournament-banners').remove([oldPath]).catch(() => {});
  }

  const { data } = supabase.storage.from('tournament-banners').getPublicUrl(path);
  return data.publicUrl;
}
