import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Video as VideoCompressor } from 'react-native-compressor';
import { supabase } from './supabase';
import { RawImage } from './chatImage';

export const MAX_VIDEO_DURATION_MS = 60_000;

export type RawVideo = { uri: string; width: number; height: number; durationMs: number };
export type PickedChatMedia =
  | { type: 'image'; image: RawImage }
  | { type: 'video'; video: RawVideo };

// One tap into the gallery can return either an image or a video --
// mirrors WhatsApp's attach button rather than adding a second option
// just for video. Camera capture (the other half of the picker source
// sheet) stays photo-only; recording video wasn't asked for, only
// picking one from the gallery.
export async function pickChatGalleryMedia(): Promise<PickedChatMedia | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is required to choose a photo or video.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 1,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];

  if (asset.type === 'video') {
    // Gallery picks aren't covered by the picker's own videoMaxDuration
    // option -- that only limits fresh recordings via the camera -- so
    // the 60s cap has to be enforced here, after the fact.
    if ((asset.duration ?? 0) > MAX_VIDEO_DURATION_MS) {
      throw new Error('Videos must be 60 seconds or shorter. Trim it and try again.');
    }
    return {
      type: 'video',
      video: { uri: asset.uri, width: asset.width, height: asset.height, durationMs: asset.duration ?? 0 },
    };
  }

  return { type: 'image', image: { uri: asset.uri, width: asset.width, height: asset.height } };
}

export type CompressedVideo = {
  uri: string;
  thumbnailUri: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
};

// maxSize: 720 caps the longer side at 720px -- plenty for a phone
// screen, and the actual point of compressing at all (WhatsApp-style)
// rather than shipping whatever resolution the source video happened
// to be shot at.
export async function compressChatVideo(uri: string, onProgress?: (pct: number) => void): Promise<CompressedVideo> {
  const compressedUri = await VideoCompressor.compress(
    uri,
    { compressionMethod: 'auto', maxSize: 720 },
    (progress) => onProgress?.(progress)
  );

  // A frame 100ms in rather than the exact first frame, which is more
  // likely to be a hard cut/black frame than something representative.
  const { uri: thumbnailUri, width, height } = await VideoThumbnails.getThumbnailAsync(compressedUri, {
    time: 100,
    quality: 0.7,
  });

  return { uri: compressedUri, thumbnailUri, thumbnailWidth: width, thumbnailHeight: height };
}

// Local file URIs, not base64 -- a compressed video is still large
// enough that inflating it ~33% through a base64 round-trip (the
// pattern every image upload in this app uses) would be wasteful.
// fetch().blob() reads the file directly instead.
async function uploadBlob(path: string, uri: string, contentType: string): Promise<void> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from('chat-images').upload(path, blob, { contentType });
  if (error) throw error;
}

export async function uploadChatVideo(
  conversationId: string,
  senderId: string,
  video: CompressedVideo
): Promise<{ videoPath: string; thumbnailPath: string }> {
  const timestamp = Date.now();
  const videoPath = `${conversationId}/${senderId}/${timestamp}.mp4`;
  const thumbnailPath = `${conversationId}/${senderId}/${timestamp}_thumb.jpg`;

  await uploadBlob(videoPath, video.uri, 'video/mp4');
  await uploadBlob(thumbnailPath, video.thumbnailUri, 'image/jpeg');

  return { videoPath, thumbnailPath };
}
