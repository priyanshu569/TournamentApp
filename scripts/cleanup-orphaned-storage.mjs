// Finds (and optionally deletes) files sitting in Supabase Storage that no
// row in the database points to any more -- the backlog left behind before
// avatar/banner/group-photo/reward-image uploads started cleaning up after
// themselves on replace (see lib/avatarUpload.ts, bannerUpload.ts,
// groupAvatar.ts, rewardImageUpload.ts).
//
// Requires the SERVICE ROLE key (not the public anon key) -- it has to read
// every user's storage folder and every row, bypassing RLS. Get it from
// Supabase Dashboard > Project Settings > API > service_role secret, and
// NEVER commit it or put it in app code; it only lives in your shell here.
//
// Dry run (default -- lists what WOULD be deleted, deletes nothing):
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/cleanup-orphaned-storage.mjs
//
// Actually delete the orphans it found:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/cleanup-orphaned-storage.mjs --delete

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DELETE = process.argv.includes('--delete');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// One entry per bucket that had an unprotected "replace" flow: which table
// and column(s) hold the URLs that are still actually in use.
const TARGETS = [
  { bucket: 'profile-photos', table: 'Profiles', columns: ['avatar_url'] },
  { bucket: 'tournament-banners', table: 'tournaments', columns: ['banner_url'] },
  { bucket: 'group-photos', table: 'conversations', columns: ['avatar_url'] },
  { bucket: 'reward-images', table: 'reward_catalog', columns: ['image_urls'] }, // array column
];

function pathFromPublicUrl(url, bucket) {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

// Storage .list() only returns one directory level at a time, and uploads
// here are one level deep (ownerId/filename.jpg), so: list the root for
// owner folders, then list inside each one.
async function listAllFiles(bucket) {
  const files = [];

  const { data: topLevel, error } = await supabase.storage.from(bucket).list('', { limit: 10000 });
  if (error) throw new Error(`Listing ${bucket}: ${error.message}`);

  for (const entry of topLevel ?? []) {
    // A real file at the root (shouldn't happen given the upload paths
    // used, but don't silently skip it if it does).
    if (entry.id !== null) {
      files.push({ path: entry.name, size: entry.metadata?.size ?? 0 });
      continue;
    }

    const { data: inner, error: innerError } = await supabase.storage.from(bucket).list(entry.name, { limit: 10000 });
    if (innerError) throw new Error(`Listing ${bucket}/${entry.name}: ${innerError.message}`);

    for (const file of inner ?? []) {
      files.push({ path: `${entry.name}/${file.name}`, size: file.metadata?.size ?? 0 });
    }
  }

  return files;
}

async function referencedPaths(bucket, table, columns) {
  const { data, error } = await supabase.from(table).select(columns.join(','));
  if (error) throw new Error(`Querying ${table}: ${error.message}`);

  const referenced = new Set();
  for (const row of data ?? []) {
    for (const col of columns) {
      const value = row[col];
      const urls = Array.isArray(value) ? value : [value];
      for (const url of urls) {
        if (!url) continue;
        const path = pathFromPublicUrl(url, bucket);
        if (path) referenced.add(path);
      }
    }
  }
  return referenced;
}

async function main() {
  let totalOrphanBytes = 0;
  let totalOrphanCount = 0;

  for (const { bucket, table, columns } of TARGETS) {
    console.log(`\n=== ${bucket} ===`);

    const [allFiles, referenced] = await Promise.all([
      listAllFiles(bucket),
      referencedPaths(bucket, table, columns),
    ]);

    const orphans = allFiles.filter((f) => !referenced.has(f.path));
    const orphanBytes = orphans.reduce((sum, f) => sum + f.size, 0);

    console.log(`${allFiles.length} files in storage, ${referenced.size} referenced in ${table}, ${orphans.length} orphaned (${(orphanBytes / 1024 / 1024).toFixed(2)} MB)`);

    if (orphans.length === 0) continue;

    totalOrphanCount += orphans.length;
    totalOrphanBytes += orphanBytes;

    if (DELETE) {
      // Storage remove() takes at most a few hundred paths comfortably per
      // call in practice -- batch to stay well under any request-size limit.
      const BATCH = 100;
      for (let i = 0; i < orphans.length; i += BATCH) {
        const batch = orphans.slice(i, i + BATCH).map((f) => f.path);
        const { error } = await supabase.storage.from(bucket).remove(batch);
        if (error) console.error(`  Failed to delete batch in ${bucket}: ${error.message}`);
        else console.log(`  Deleted ${batch.length} files`);
      }
    } else {
      for (const f of orphans.slice(0, 20)) console.log(`  would delete: ${f.path} (${(f.size / 1024).toFixed(1)} KB)`);
      if (orphans.length > 20) console.log(`  ...and ${orphans.length - 20} more`);
    }
  }

  console.log(`\nTotal orphaned: ${totalOrphanCount} files, ${(totalOrphanBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(DELETE ? 'Deleted the files listed above.' : 'Dry run only -- nothing was deleted. Re-run with --delete to actually remove them.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
