/**
 * Plain-language decoding of saved IATI XML snippets.
 * Meaning comes ONLY from coded XML fields (transaction-type code, budget element).
 * The publisher's free-text `ref` is shown verbatim but never used to infer meaning.
 */

export type FinancialKind = 'received' | 'transferred' | 'spent' | 'budget' | 'reported';

export const KIND_LABEL: Record<FinancialKind, string> = {
  received: 'Money received',
  transferred: 'Money transferred',
  spent: 'Money spent',
  budget: 'Reported budget',
  reported: 'Reported transaction',
};

export const KIND_EXPLAIN: Record<FinancialKind, string> = {
  received: 'Money this organization reports receiving for this work.',
  transferred: 'Money reported as made available to another organization or activity.',
  spent: 'Money reported as paid out for goods and services for this work. It may not all be spent by the organization itself.',
  budget: 'A planned amount for a period. A budget is not money received or spent.',
  reported: 'A money entry whose type nujli. does not translate. Shown as reported; its meaning is not guessed.',
};

export interface SourceField { name: string; value: string }

export interface FinancialEntry {
  kind: FinancialKind;
  typeCode: string | null;
  label: string;
  rawAmount: string;
  amount: number | null;
  currency: string;
  transactionDate: string | null;
  valueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  provider: string | null;
  receiver: string | null;
  ref: string | null;
  fields: SourceField[];
}

const BUDGET_TYPE: Record<string, string> = { '1': 'Original', '2': 'Revised' };
const BUDGET_STATUS: Record<string, string> = { '1': 'Indicative', '2': 'Committed' };

function looksLikeXml(s: string | null | undefined): s is string {
  return !!s && s.trim().startsWith('<');
}

/** Safe parse: rejects DTDs/entities and parser errors. Returns null when not decodable. */
export function parseXmlSnippet(xml: string, parser?: DOMParser): Element | null {
  if (!looksLikeXml(xml)) return null;
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return null;
  const P = parser ?? (typeof DOMParser !== 'undefined' ? new DOMParser() : null);
  if (!P) return null;
  let doc: Document;
  try { doc = P.parseFromString(`<nujli-root>${xml.trim()}</nujli-root>`, 'application/xml'); } catch { return null; }
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  if (doc.doctype) return null;
  const el = doc.documentElement?.firstElementChild ?? null;
  return el;
}

const txt = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim() || null;
const attr = (el: Element | null | undefined, a: string) => (el?.getAttribute(a) ?? '').trim() || null;
const child = (el: Element, name: string) => {
  for (const c of Array.from(el.children)) if (c.localName === name) return c;
  return null;
};

export function decodeFinancial(xml: string | null | undefined, parser?: DOMParser): FinancialEntry | null {
  if (!xml) return null;
  const el = parseXmlSnippet(xml, parser);
  if (!el) return null;
  const valueEl = child(el, 'value');
  if (!valueEl) return null;
  const rawAmount = (valueEl.textContent ?? '').trim();
  const amount = /^-?\d+(\.\d+)?$/.test(rawAmount) ? Number(rawAmount) : null;
  const currency = attr(valueEl, 'currency') ?? '';
  const valueDate = attr(valueEl, 'value-date');

  if (el.localName === 'budget') {
    const ps = attr(child(el, 'period-start'), 'iso-date');
    const pe = attr(child(el, 'period-end'), 'iso-date');
    const bt = attr(el, 'type'); const bs = attr(el, 'status');
    const fields: SourceField[] = [
      { name: 'Element', value: 'budget' },
      { name: 'Amount (as published)', value: rawAmount || 'Not reported' },
      { name: 'Currency', value: currency || 'Not reported' },
      { name: 'Period start', value: ps ?? 'Not reported' },
      { name: 'Period end', value: pe ?? 'Not reported' },
      { name: 'Value date', value: valueDate ?? 'Not reported' },
    ];
    if (bt) fields.push({ name: 'Budget type code', value: BUDGET_TYPE[bt] ? `${bt} (${BUDGET_TYPE[bt]})` : bt });
    if (bs) fields.push({ name: 'Budget status code', value: BUDGET_STATUS[bs] ? `${bs} (${BUDGET_STATUS[bs]})` : bs });
    return { kind: 'budget', typeCode: null, label: KIND_LABEL.budget, rawAmount, amount, currency, transactionDate: null, valueDate, periodStart: ps, periodEnd: pe, provider: null, receiver: null, ref: null, fields };
  }

  if (el.localName !== 'transaction') return null;
  const code = attr(child(el, 'transaction-type'), 'code');
  const kind: FinancialKind = code === '1' ? 'received' : code === '3' ? 'transferred' : code === '4' ? 'spent' : 'reported';
  const tDate = attr(child(el, 'transaction-date'), 'iso-date');
  const prov = child(el, 'provider-org'); const recv = child(el, 'receiver-org');
  const provider = txt(prov ? child(prov, 'narrative') : null);
  const receiver = txt(recv ? child(recv, 'narrative') : null);
  const ref = attr(el, 'ref');
  const flow = attr(child(el, 'flow-type'), 'code');
  const fields: SourceField[] = [
    { name: 'Transaction type code', value: code ?? 'Not reported' },
    { name: 'Amount (as published)', value: rawAmount || 'Not reported' },
    { name: 'Currency', value: currency || 'Not reported' },
    { name: 'Transaction date', value: tDate ?? 'Not reported' },
    { name: 'Value date', value: valueDate ?? 'Not reported' },
    { name: 'Provider', value: provider ?? 'Not reported' },
    { name: 'Receiver', value: receiver ?? 'Not reported' },
    { name: 'Publisher reference (free text)', value: ref ?? 'Not reported' },
  ];
  if (flow) fields.push({ name: 'Flow type code', value: flow });
  return { kind, typeCode: code, label: KIND_LABEL[kind], rawAmount, amount, currency, transactionDate: tDate, valueDate, periodStart: null, periodEnd: null, provider, receiver, ref, fields };
}

/** Consistent currency formatting with thousands separators; raw value kept elsewhere. */
export function fmtAmount(amount: number | null, currency: string, raw?: string): string {
  if (amount === null) return raw ? `${raw}${currency ? ` ${currency}` : ' (currency not reported)'}` : 'Not reported';
  const rawDec = raw && /^-?\d+\.(\d+)$/.exec(raw.trim());
  const dec = rawDec ? Math.min(20, rawDec[1].length) : Number.isInteger(amount) ? 0 : 2;
  const opts = { minimumFractionDigits: dec, maximumFractionDigits: Math.max(dec, 2) };
  if (!currency) return `${new Intl.NumberFormat('en-GB', opts).format(amount)} (currency not reported)`;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, ...opts }).format(amount);
  } catch {
    return `${new Intl.NumberFormat('en-GB', opts).format(amount)} ${currency}`;
  }
}

/** Formats an ISO day (YYYY-MM-DD) without timezone drift. */
export function fmtDay(v?: string | null): string {
  if (!v) return 'Not reported';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return v;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Date used to order an entry: transaction date for transactions, period start for budgets. */
export function entryDate(e: FinancialEntry): string | null {
  return e.kind === 'budget' ? e.periodStart : e.transactionDate;
}

export interface HeadlineInput { id: string; quote: string; label: string; value: string; asOf: string | null }

/** Most recent single entry (spent, then transferred, then received); never a sum. */
export function pickHeadline<T extends HeadlineInput>(stats: T[], decode: boolean, parser?: DOMParser): { stat: T; fin: FinancialEntry | null } | null {
  const rows = stats.map((stat) => ({ stat, fin: decode ? decodeFinancial(stat.quote, parser) : null }));
  const latest = (k: FinancialKind) => rows.filter((r) => r.fin?.kind === k && r.fin.transactionDate)
    .sort((a, b) => b.fin!.transactionDate!.localeCompare(a.fin!.transactionDate!))[0];
  return latest('spent') ?? latest('transferred') ?? latest('received') ?? rows.find((r) => r.fin) ?? rows.find((r) => r.stat.value?.trim()) ?? null;
}
