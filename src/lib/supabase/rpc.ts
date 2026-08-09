import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

type Functions = Database['public']['Functions'];
type RpcArgs<FnName extends keyof Functions> = [Functions[FnName]['Args']] extends [never]
  ? Record<string, never>
  : Functions[FnName]['Args'];

// This wrapper preserves the generated database contract while allowing
// zero-argument Postgres functions (which Supabase represents as Args: never)
// to be called consistently with an empty object.
export async function callRpc<FnName extends keyof Functions & string>(
  client: SupabaseClient<Database>,
  fn: FnName,
  args: RpcArgs<FnName>,
): Promise<Functions[FnName]['Returns']> {
  const result = await client.rpc(fn, args);

  if (result.error) {
    throw result.error;
  }
  return result.data;
}
