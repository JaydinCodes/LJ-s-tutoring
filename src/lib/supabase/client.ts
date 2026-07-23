import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Exported for direct fetch() calls that can't go through the supabase-js
// client -- e.g. streaming Edge Function responses, where .functions.invoke()
// buffers the whole body instead of exposing it chunk by chunk.
export { supabaseUrl, supabaseAnonKey };

function isUsableEnvValue(value: string | undefined) {
  return Boolean(value && value.trim() && !value.includes('${') && !value.includes('}'));
}

function isValidHttpUrl(value: string | undefined) {
  if (!isUsableEnvValue(value)) {
    return false;
  }

  try {
    const parsed = new URL(value as string);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = isValidHttpUrl(supabaseUrl) && isUsableEnvValue(supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error('The requested service is temporarily unavailable. Please contact support if the issue continues.');
  }

  return supabase;
}
