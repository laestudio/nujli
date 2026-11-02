import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, LocateFixed, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getParticleField, MAP_H, MAP_W, project } from '@/lib/geo';
import type { ParticleField } from '@/lib/geo';

export interface MapMarker { id: string; lat: number; lng: number; label: string }
interface View { k: number; tx: number; ty: number }
/** Size-independent camera: centre in degrees plus zoom factor. */
export interface MapCamera { lat: number; lng: number; k: number }
export function isValidCamera(c: unknown): c is MapCamera {
  if (!c || typeof c !== 'object') return false;
  const { lat, lng, k } = c as Record<string, unknown>;
  return typeof lat === 'number' && typeof lng === 'number' && typeof k === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(k)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && k >= 1 && k <= 60;
}

function useReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const h = () => setR(m.matches);
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);
  return r;
}
export { useReducedMotion };

export function WorldMap({
  markers = [], selectedId, onSelect, interactive = true, className, focusId, label = 'World map of published projects', wheelZoom = true, drift = false,
  initialView, onViewChange, focusNonce = 0, dimUnselected = false,
}: {
  initialView?: MapCamera | null; onViewChange?: (c: MapCamera) => void; focusNonce?: number; dimUnselected?: boolean;
  markers?: MapMarker[]; selectedId?: string | null; onSelect?: (id: string) => void; interactive?: boolean;
  className?: string; focusId?: string | null; label?: string; wheelZoom?: boolean; drift?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [field, setField] = useState<ParticleField | null>(null);
  const [view, setView] = useState<View>({ k: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const reduced = useReducedMotion();
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const moved = useRef(false);
  const [drifting, setDrifting] = useState(drift);
  const stopDrift = useCallback(() => setDrifting(false), []);
  const inited = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => setField(getParticleField()), 16);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = useMemo(() => {
    const s = Math.min(size.w / MAP_W, size.h / MAP_H) || 1;
    return { s, ox: (size.w - MAP_W * s) / 2, oy: (size.h - MAP_H * s) / 2 };
  }, [size]);
  const baseRef = useRef(base);
  baseRef.current = base;

  const toScreen = useCallback((x: number, y: number, v: View) => [
    (x * base.s + base.ox) * v.k + v.tx, (y * base.s + base.oy) * v.k + v.ty,
  ] as const, [base]);

  const regionView = useCallback((): View => {
    const b = baseRef.current;
    // show ~38deg of longitude on wide screens, ~22deg on phones
    const span = size.w < 640 ? 22 : 38;
    const k = Math.min(30, Math.max(2, size.w / ((span / 360) * MAP_W * b.s)));
    const [x, y] = project(31, 35);
    return { k, tx: size.w / 2 - (x * b.s + b.ox) * k, ty: size.h / 2 - (y * b.s + b.oy) * k };
  }, [size]);

  useEffect(() => {
    if (!size.w || inited.current) return;
    inited.current = true;
    if (initialView && isValidCamera(initialView)) {
      const b = baseRef.current; const [x, y] = project(initialView.lat, initialView.lng);
      const k = initialView.k;
      setDrifting(false);
      setView({ k, tx: size.w / 2 - (x * b.s + b.ox) * k, ty: size.h / 2 - (y * b.s + b.oy) * k });
    } else setView(regionView());
    // initialView is only read once on first layout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, regionView]);

  const onViewRef = useRef(onViewChange);
  onViewRef.current = onViewChange;
  useEffect(() => {
    if (!inited.current || !size.w || !onViewRef.current) return;
    const t = window.setTimeout(() => {
      const lng = ((size.w / 2 - view.tx) / view.k - base.ox) / base.s / MAP_W * 360 - 180;
      const lat = 90 - ((size.h / 2 - view.ty) / view.k - base.oy) / base.s / MAP_H * 180;
      const c = { lat: Math.max(-90, Math.min(90, lat)), lng: Math.max(-180, Math.min(180, lng)), k: view.k };
      if (isValidCamera(c)) onViewRef.current?.(c);
    }, 300);
    return () => window.clearTimeout(t);
  }, [view, size, base]);

  // gentle drift until first interaction
  const active = drifting && !reduced && size.w > 0;
  useEffect(() => {
    if (!active) return;
    let raf = 0; let last = 0; const t0 = performance.now();
    const tick = (now: number) => {
      const off = Math.sin((now - t0) / 7000) * 26;
      const d = off - last; last = off;
      setView((v) => ({ ...v, tx: v.tx + d }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setView((v) => {
      const k = Math.min(60, Math.max(1, v.k * factor));
      const f = k / v.k;
      if (k === 1) return { k: 1, tx: 0, ty: 0 };
      return { k, tx: px - (px - v.tx) * f, ty: py - (py - v.ty) * f };
    });
  }, []);

  const startRef = useRef(performance.now());
  // draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !field || !size.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size.w * dpr; canvas.height = size.h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const start = startRef.current;
    const draw = (now: number) => {
      const v = viewRef.current; const b = baseRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0A0908';
      ctx.fillRect(0, 0, size.w, size.h);
      const sk = b.s * v.k;
      const ox = b.ox * v.k + v.tx; const oy = b.oy * v.k + v.ty;
      {
        const [lx, ly] = project(33, 32);
        const fs = Math.max(11, Math.min(34, sk * 1.6));
        ctx.font = `500 ${fs}px 'Reem Kufi', sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.direction = 'rtl';
        ctx.fillStyle = 'rgba(243,236,221,0.34)';
        ctx.fillText('فلسطين', lx * sk + ox, ly * sk + oy);
        ctx.direction = 'ltr';
      }
      const P = field.points; const E = field.edges;
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = 'rgba(243,236,221,0.10)';
      ctx.beginPath();
      for (let i = 0; i < E.length; i += 2) {
        const a = E[i] * 2; const c = E[i + 1] * 2;
        ctx.moveTo(P[a] * sk + ox, P[a + 1] * sk + oy);
        ctx.lineTo(P[c] * sk + ox, P[c + 1] * sk + oy);
      }
      ctx.stroke();
      const sweep = reduced ? -9999 : (((now - start) / 9000) % 1.3) * MAP_W - 100;
      const r = Math.min(2.4, 0.9 + Math.sqrt(sk) * 0.55);
      for (let i = 0; i < P.length; i += 2) {
        const x = P[i] * sk + ox; const y = P[i + 1] * sk + oy;
        if (x < -4 || y < -4 || x > size.w + 4 || y > size.h + 4) continue;
        const d = Math.abs(P[i] - sweep);
        const lift = d < 60 ? (1 - d / 60) * 0.45 : 0;
        ctx.fillStyle = `rgba(243,236,221,${0.42 + lift})`;
        ctx.fillRect(x - r / 2, y - r / 2, r, r);
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [field, size, reduced, reduced ? view : null]);

  // wheel
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      if (!wheelZoom && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      stopDrift();
      const rect = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [interactive, zoomAt, wheelZoom, stopDrift]);

  // focus a marker
  useEffect(() => {
    if (!focusId || !size.w) return;
    setDrifting(false);
    const m = markers.find((x) => x.id === focusId);
    if (!m) return;
    const [x, y] = project(m.lat, m.lng);
    const from = viewRef.current;
    const k = Math.max(from.k, 9);
    const bx = x * base.s + base.ox; const by = y * base.s + base.oy;
    const to = { k, tx: size.w / 2 - bx * k, ty: size.h / 2 - by * k };
    if (reduced) { setView(to); return; }
    // controlled approach: interpolate centre in map space + zoom geometrically
    const cx0 = (size.w / 2 - from.tx) / from.k; const cy0 = (size.h / 2 - from.ty) / from.k;
    let raf = 0; const t0 = performance.now(); const dur = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - t, 3);
      const kk = from.k * Math.pow(k / from.k, e);
      const cx = cx0 + (bx - cx0) * e; const cy = cy0 + (by - cy0) * e;
      setView({ k: kk, tx: size.w / 2 - cx * kk, ty: size.h / 2 - cy * kk });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, focusNonce, base, size, reduced]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    stopDrift();
    if ((e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) {
        const rect = wrapRef.current!.getBoundingClientRect();
        zoomAt(dist / pinch.current, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      }
      pinch.current = dist;
      return;
    }
    const dx = cur.x - prev.x; const dy = cur.y - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) moved.current = true;
    setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!interactive || e.target !== e.currentTarget) return;
    stopDrift();
    const step = 60;
    const c = [size.w / 2, size.h / 2] as const;
    const map: Record<string, () => void> = {
      ArrowLeft: () => setView((v) => ({ ...v, tx: v.tx + step })),
      ArrowRight: () => setView((v) => ({ ...v, tx: v.tx - step })),
      ArrowUp: () => setView((v) => ({ ...v, ty: v.ty + step })),
      ArrowDown: () => setView((v) => ({ ...v, ty: v.ty - step })),
      '+': () => zoomAt(1.3, c[0], c[1]), '=': () => zoomAt(1.3, c[0], c[1]),
      '-': () => zoomAt(1 / 1.3, c[0], c[1]), '0': () => setView({ k: 1, tx: 0, ty: 0 }),
    };
    map.r = () => setView(regionView());
    const fn = map[e.key];
    if (fn) { e.preventDefault(); fn(); }
  };

  return (
    <div
      ref={wrapRef}
      className={cn('relative overflow-hidden bg-ink select-none', wheelZoom ? 'touch-none' : 'touch-pan-y', interactive && 'cursor-grab active:cursor-grabbing', className)}
      role="application"
      aria-label={`${label}. ${interactive ? 'Use arrow keys to pan, plus and minus to zoom, 0 for the full world, R for the region. Tab to reach project markers.' : ''}`}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={onKey}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      data-testid="map-world"
      data-zoom={view.k.toFixed(2)}
      data-center-lng={size.w ? (((size.w / 2 - view.tx) / view.k - base.ox) / base.s / MAP_W * 360 - 180).toFixed(2) : undefined}
      data-center-lat={size.w ? (90 - ((size.h / 2 - view.ty) / view.k - base.oy) / base.s / MAP_H * 180).toFixed(2) : undefined}
      data-drift={active ? 'on' : 'off'}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      {!field && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="meta text-paper/50">Plotting coastlines</span>
        </div>
      )}
      {size.w > 0 && markers.map((m) => {
        const [x, y] = project(m.lat, m.lng);
        const [sx, sy] = toScreen(x, y, view);
        if (sx < -20 || sy < -20 || sx > size.w + 20 || sy > size.h + 20) return null;
        const on = m.id === selectedId;
        const dim = dimUnselected && !!selectedId && !on;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect?.(m.id)}
            aria-label={`Project: ${m.label}`}
            aria-pressed={on}
            title={m.label}
            data-testid={`marker-project-${m.id}`}
            className={cn('group absolute -translate-x-1/2 -translate-y-1/2 grid place-items-center h-11 w-11 rounded-full focus-visible:outline-2 transition-opacity duration-500', dim && 'opacity-30 hover:opacity-90 focus-visible:opacity-100', on && 'z-10')}
            style={{ left: sx, top: sy }}
          >
            {!reduced && !dim && <span className="absolute h-3 w-3 rounded-full bg-vermilion/50 pulse-ring" aria-hidden />}
            <svg viewBox="-10 -10 20 20" aria-hidden className={cn('relative star-mark transition-transform', on ? 'h-6 w-6 scale-110' : 'h-4 w-4 group-hover:scale-150')}>
              <rect x="-6" y="-6" width="12" height="12" fill="#D42A2F" stroke={on ? '#F3ECDD' : 'none'} strokeWidth="1.2" />
              <rect x="-6" y="-6" width="12" height="12" fill="#D42A2F" stroke={on ? '#F3ECDD' : 'none'} strokeWidth="1.2" transform="rotate(45)" />
              <rect x="-4.3" y="-4.3" width="8.6" height="8.6" fill="#D42A2F" />
            </svg>
            <span className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm bg-paper px-2 py-0.5 text-[11px] font-medium text-ink opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
              {m.label}
            </span>
          </button>
        );
      })}
      {interactive && !wheelZoom && (
        <p className="pointer-events-none absolute right-14 bottom-4 hidden sm:block meta text-paper/45">Drag to pan / Ctrl + scroll or buttons to zoom</p>
      )}
      {interactive && (
        <div className="absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-sm border border-paper/20 bg-ink/80 backdrop-blur">
          <button type="button" aria-label="Zoom in" data-testid="button-zoom-in" onClick={() => { stopDrift(); zoomAt(1.4, size.w / 2, size.h / 2); }} className="grid h-11 w-11 place-items-center text-paper hover:bg-paper/10"><Plus className="h-4 w-4" /></button>
          <button type="button" aria-label="Zoom out" data-testid="button-zoom-out" onClick={() => { stopDrift(); zoomAt(1 / 1.4, size.w / 2, size.h / 2); }} className="grid h-11 w-11 place-items-center text-paper hover:bg-paper/10 border-t border-paper/15"><Minus className="h-4 w-4" /></button>
          <button type="button" aria-label="Center on region" title="Center on region" data-testid="button-zoom-region" onClick={() => { stopDrift(); setView(regionView()); }} className="grid h-11 w-11 place-items-center text-paper hover:bg-paper/10 border-t border-paper/15"><LocateFixed className="h-4 w-4" /></button>
          <button type="button" aria-label="Show full world" title="Show full world" data-testid="button-zoom-reset" onClick={() => { stopDrift(); setView({ k: 1, tx: 0, ty: 0 }); }} className="grid h-11 w-11 place-items-center text-paper hover:bg-paper/10 border-t border-paper/15"><Globe2 className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
