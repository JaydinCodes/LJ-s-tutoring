type StructuredDataValue = Record<string, unknown> | Array<Record<string, unknown>>;

export function StructuredData({ data }: { data: StructuredDataValue }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
