import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Directory, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

// Mirrors WhatsApp's standard-quality send: cap the longest side (most
// of the file-size win comes from resolution, not quality) then
// compress at a quality comparable to WhatsApp's own, rather than only
// turning the quality knob down on an untouched full-resolution photo.
const MAX_DIMENSION = 1600;
const CHAT_IMAGE_QUALITY = 0.75;

export type PickedChatImage = { base64: string; width: number; height: number };

export async function pickChatImage(source: 'camera' | 'library'): Promise<PickedChatImage | null> {
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

  // quality: 1 here -- resizing + compressing happens once, below, via
  // ImageManipulator. Compressing twice (once in the picker, again in
  // the manipulator) would just stack JPEG artifacts for no benefit.
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
  };

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled) return null;

  const asset = result.assets[0];
  return resizeAndCompress(asset.uri, asset.width, asset.height);
}

async function resizeAndCompress(uri: string, width: number, height: number): Promise<PickedChatImage> {
  const context = ImageManipulator.manipulate(uri);

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    context.resize(
      width >= height
        ? { width: MAX_DIMENSION, height: null }
        : { width: null, height: MAX_DIMENSION }
    );
  }

  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: CHAT_IMAGE_QUALITY,
    base64: true,
  });

  if (!result.base64) throw new Error('Failed to process image.');
  return { base64: result.base64, width: result.width, height: result.height };
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

// Atomically consumes a view-once photo server-side (marks it viewed +
// clears messages.image_url so it can never be fetched through the app
// again) and returns the storage path it had, which is still resolved
// into a signed URL here since the RPC only clears the DB reference --
// the object itself is untouched, and this signed URL is the one and
// only chance to see it.
export async function revealViewOnceImage(messageId: string): Promise<string> {
  const { data: path, error } = await supabase.rpc('reveal_view_once_message', { p_message_id: messageId });
  if (error) throw error;
  return getSignedChatImageUrl(path as string);
}

// MediaLibrary needs a local file, not a remote URL -- download the
// signed URL to cache first, then hand that off and clean up.
export async function saveChatImageToGallery(signedUrl: string): Promise<void> {
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) {
    throw new Error('Photo library access is required to save this image.');
  }

  const cacheDir = new Directory(Paths.cache, 'fragify-downloads');
  try {
    cacheDir.create({ intermediates: true });
  } catch {
    // Already exists -- fine.
  }

  const destination = new File(cacheDir, `${Date.now()}.jpg`);
  const downloaded = await File.downloadFileAsync(signedUrl, destination);

  try {
    await MediaLibrary.saveToLibraryAsync(downloaded.uri);
  } finally {
    downloaded.delete();
  }
}
