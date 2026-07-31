import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

// Proof screenshots live in a private bucket -- only the reporter and
// admins can read them back (see 20260731170000_improve_reports.sql).
export async function uploadReportProofImage(reporterId: string, base64: string): Promise<string> {
  const path = `${reporterId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from('report-proof-images')
    .upload(path, decode(base64), { contentType: 'image/jpeg' });

  if (error) throw error;
  return path;
}

export async function getSignedReportProofUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('report-proof-images')
    .createSignedUrl(path, 3600);

  if (error) throw error;
  return data.signedUrl;
}
