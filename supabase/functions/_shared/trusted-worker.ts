/**
 * Verifies a privileged internal caller independently of the Edge gateway.
 *
 * `verify_jwt = true` remains mandatory for the worker functions, but a JWT
 * payload is not proof of its signature. The only internal principal these
 * functions accept is the exact service-role key injected by Supabase. This
 * makes a forged `{ role: "service_role" }` payload harmless even if a
 * deployment ever weakens gateway verification.
 */
export function isTrustedServiceWorkerToken(token: string, serviceRoleKey: string): boolean {
  if (!token || !serviceRoleKey || token.length !== serviceRoleKey.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < token.length; index += 1) {
    difference |= token.charCodeAt(index) ^ serviceRoleKey.charCodeAt(index);
  }
  return difference === 0;
}
