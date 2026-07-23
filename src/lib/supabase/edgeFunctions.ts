import { requireSupabase, supabaseAnonKey, supabaseUrl } from './client';

// Streaming Edge Function responses need a direct fetch(): supabase-js's
// .functions.invoke() buffers the whole response body before resolving,
// which defeats the purpose of a streamed chat reply. Mirrors
// src/lib/api/client.ts's apiStreamText() exactly, including its HTML
// fallback guard, just against a Supabase Edge Function URL with the current
// session's access token instead of the legacy API base.
export async function streamSupabaseFunctionText(
  functionName: string,
  body: unknown,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
) {
  const client = requireSupabase();
  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('assistant_auth_required');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    signal,
    headers: {
      accept: 'text/plain',
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey || '',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(responseBody || `request_failed:${response.status}`);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    throw new Error(`api_html_response:${response.status}`);
  }
  if (contentType && !contentType.includes('text/plain') && !contentType.includes('text/event-stream')) {
    throw new Error(`api_unexpected_stream_response:${response.status}`);
  }

  if (!response.body) {
    throw new Error('api_stream_unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let hasAcceptedContent = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;
    if (!hasAcceptedContent && /^(\s*)(<!doctype\s+html|<html[\s>])/i.test(chunk)) {
      throw new Error(`api_html_response:${response.status}`);
    }
    hasAcceptedContent = true;
    onChunk(chunk);
  }

  const finalChunk = decoder.decode();
  if (finalChunk) {
    if (!hasAcceptedContent && /^(\s*)(<!doctype\s+html|<html[\s>])/i.test(finalChunk)) {
      throw new Error(`api_html_response:${response.status}`);
    }
    onChunk(finalChunk);
  }
}
