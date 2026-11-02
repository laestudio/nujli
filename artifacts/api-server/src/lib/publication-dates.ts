import { createHash } from "node:crypto";

// Content identities survive replacement of row IDs during draft revision. Client dates
// are deliberately ignored; only the publication transaction writes this ledger.
const fields = {
  claims: ["text", "quote", "sourceUrl"],
  statistics: ["label", "value", "unit", "sourceUrl", "quote", "asOf"],
  updates: ["title", "date", "body", "sourceUrl", "quote"],
  media: ["url", "type", "caption", "sourceUrl"],
} as const;
type Kind = keyof typeof fields;
type RecordData = Record<string, unknown>;
export type PublicationLedger = Record<string, string>;

export function publicationKey(kind: Kind, record: RecordData) {
  const canonical = fields[kind].map(key => record[key] ?? null);
  return `${kind}:${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`;
}

export function withPublicationDates<T extends RecordData>(kind: Kind, records: T[], ledger: PublicationLedger) {
  return records.map(record => ({ ...record, publishedAt: ledger[publicationKey(kind, record)] ?? null }));
}

export function recordPublication(
  project: Record<Kind, RecordData[]>,
  ledger: PublicationLedger,
  publishedAt: string,
): PublicationLedger {
  const next = { ...ledger };
  for (const kind of Object.keys(fields) as Kind[]) {
    for (const record of project[kind]) {
      if (kind === "media" && record.permissionStatus !== "approved") continue;
      const key = publicationKey(kind, record);
      next[key] ??= publishedAt;
    }
  }
  return next;
}
