import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

type Functions = Database['public']['Functions'];

// supabase-js 2.106.2's generic `.rpc<FnName, Args>()` overload fails to infer
// Args for any function with a non-empty argument object (FnName resolves,
// but the second parameter's type falls back to `undefined`) -- a known
// inference limitation, not a defect in the Database type. src/lib/audit/
// auditLog.ts already works around the identical issue for record_audit_event
// with a one-off inline cast; this is that same cast, centralized so callers
// don't repeat it, and still fully typed at the call site via `Functions`.
export async function callRpc<FnName extends keyof Functions & string>(
  client: SupabaseClient<Database>,
  fn: FnName,
  args: Functions[FnName]['Args'],
): Promise<Functions[FnName]['Returns']> {
  const result = await (client as unknown as {
    rpc: (name: FnName, args: Functions[FnName]['Args']) => Promise<{ data: Functions[FnName]['Returns']; error: Error | null }>;
  }).rpc(fn, args);

  if (result.error) {
    throw result.error;
  }
  return result.data;
}
