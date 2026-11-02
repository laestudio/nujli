export function errMsg(e: unknown, fallback = 'Something went wrong.'): string {
  if (!e) return fallback;
  const d = (e as { data?: unknown }).data;
  if (d && typeof d === 'object') {
    const o = d as { error?: unknown; message?: unknown };
    if (typeof o.error === 'string') return o.error;
    if (typeof o.message === 'string') return o.message;
  }
  if (typeof d === 'string' && d.trim()) return d;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export function errStatus(e: unknown): number | null {
  const s = (e as { status?: unknown })?.status;
  return typeof s === 'number' ? s : null;
}

export function fmtDate(v?: string | null): string {
  if (!v) return 'Undated';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function isoDay(v?: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

export function money(price: number, currency?: string | null): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(price);
  } catch {
    return `${price} ${currency ?? ''}`.trim();
  }
}
