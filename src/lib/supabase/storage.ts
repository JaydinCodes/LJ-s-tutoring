import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

function isAlreadyUrl(path: string) {
  return /^https?:\/\//.test(path);
}

// The assignment-files and assignment-submissions storage buckets are both
// private (see docs/supabase/schema.sql), so a bare storage path stored in
// attachment_url/file_url can never be opened directly by the browser --
// resolve it to a short-lived signed URL at read time instead (signed URLs
// expire, so they must never be persisted, only generated on demand).
export async function resolveSignedUrls(
  client: SupabaseClient<Database>,
  bucket: string,
  paths: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const uniquePaths = Array.from(new Set(paths.filter((path): path is string => typeof path === 'string' && path.length > 0 && !isAlreadyUrl(path))));
  if (!uniquePaths.length) {
    return new Map();
  }

  const result = await client.storage.from(bucket).createSignedUrls(uniquePaths, SIGNED_URL_EXPIRY_SECONDS);
  if (result.error) {
    throw result.error;
  }

  const signedUrlFailure = new Error('Could not generate all requested signed URLs.');
  const expectedPaths = new Set(uniquePaths);
  const map = new Map<string, string>();
  for (const entry of result.data || []) {
    if (
      entry.error
      || !entry.path
      || !entry.signedUrl
      || !expectedPaths.has(entry.path)
      || map.has(entry.path)
    ) {
      throw signedUrlFailure;
    }
    map.set(entry.path, entry.signedUrl);
  }
  if (map.size !== expectedPaths.size) {
    throw signedUrlFailure;
  }
  return map;
}
