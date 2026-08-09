type StructuredDataValue = Record<string, unknown> | Array<Record<string, unknown>>;

function cspNonce() {
  if (typeof document === 'undefined') {
    return undefined;
  }
  return document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') || undefined;
}

export function StructuredData({ data }: { data: StructuredDataValue }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return <script nonce={cspNonce()} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
