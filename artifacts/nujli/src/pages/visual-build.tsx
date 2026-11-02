import { Component, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearch } from 'wouter';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { Group, Mesh, MeshStandardMaterial } from 'three';
import { Vector3 } from 'three';
import { useGetVisualBuild, getGetVisualBuildQueryKey } from '@workspace/api-client-react';
import type { VisualBuildStagesItem } from '@workspace/api-client-react';
import { Page } from '@/components/shell';
import { Block, ErrorState, Kicker } from '@/components/states';
import { useReducedMotion } from '@/components/world-map';
import { cn } from '@/lib/utils';

type Part = 'foundation' | 'flooring' | 'walls' | 'openings' | 'roof' | 'dome';
const ORDER: Part[] = ['foundation', 'flooring', 'walls', 'openings', 'roof', 'dome'];

const DESC: Record<Part, string> = {
  foundation: 'Concrete base slab.',
  flooring: 'Interior prayer-hall floor.',
  walls: 'Four load-bearing walls.',
  openings: 'Entrance door and side windows.',
  roof: 'Flat roof slab.',
  dome: 'Drum and hemispherical dome.',
};

function partFor(name: string, i: number): Part {
  const n = name.toLowerCase();
  if (n.includes('found')) return 'foundation';
  if (n.includes('floor')) return 'flooring';
  if (n.includes('door') || n.includes('window')) return 'openings';
  if (n.includes('wall')) return 'walls';
  if (n.includes('dome')) return 'dome';
  if (n.includes('roof')) return 'roof';
  return ORDER[Math.min(i, ORDER.length - 1)];
}

function Grow({ on, children, reduced, hl = false }: { on: boolean; children: React.ReactNode; reduced: boolean; hl?: boolean }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    const g = ref.current; if (!g) return;
    g.traverse((o) => {
      const m = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (!m || !('emissive' in m)) return;
      if (o.userData.baseEmissive === undefined) { o.userData.baseEmissive = m.emissive.getHex(); o.userData.baseIntensity = m.emissiveIntensity; }
      if (hl) { m.emissive.setHex(0x7a1f17); m.emissiveIntensity = 0.9; } else { m.emissive.setHex(o.userData.baseEmissive); m.emissiveIntensity = o.userData.baseIntensity; }
    });
    const target = on ? 1 : 0.0001;
    const s = reduced ? target : g.scale.y + (target - g.scale.y) * Math.min(1, dt * 6);
    g.scale.set(1, s, 1);
    g.visible = s > 0.002;
  });
  return <group ref={ref} scale={[1, 0.0001, 1]}>{children}</group>;
}

function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

class GLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* WebGL failed at runtime; fallback renders */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function CssMasjid({ active, reduced, sel, zoom }: { active: Set<Part>; reduced: boolean; sel: Part | null; zoom: number }) {
  const [rot, setRot] = useState({ x: -22, y: -35 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const show = (p: Part) => ({ opacity: active.has(p) ? 1 : 0, transition: reduced ? 'none' : 'opacity .5s ease, transform .5s ease' });
  const face = 'absolute left-1/2 top-1/2 [backface-visibility:visible]';
  const W = 240, D = 190, H = 80;
  const wall = (t: string, w: number) => ({ width: w, height: H, marginLeft: -w / 2, marginTop: -H / 2, transform: t });
  const onKey = (e: React.KeyboardEvent) => {
    const m: Record<string, [number, number]> = { ArrowLeft: [0, -10], ArrowRight: [0, 10], ArrowUp: [5, 0], ArrowDown: [-5, 0] };
    const d = m[e.key]; if (!d) return; e.preventDefault();
    setRot((r) => ({ x: Math.max(-70, Math.min(-5, r.x + d[0])), y: r.y + d[1] }));
  };
  return (
    <div
      className="absolute inset-0 grid place-items-center cursor-grab active:cursor-grabbing touch-none select-none [perspective:1100px]"
      tabIndex={0}
      role="application"
      aria-label="CSS 3D conceptual masjid. Drag or use arrow keys to rotate."
      onKeyDown={onKey}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }; }}
      onPointerMove={(e) => { if (!drag.current) return; const dx = e.clientX - drag.current.x; const dy = e.clientY - drag.current.y; drag.current = { x: e.clientX, y: e.clientY }; setRot((r) => ({ x: Math.max(-70, Math.min(-5, r.x - dy * 0.3)), y: r.y + dx * 0.4 })); }}
      onPointerUp={() => { drag.current = null; }}
      data-testid="css3d-masjid"
    >
      <div className="relative h-0 w-0 [transform-style:preserve-3d]" style={{ transform: `translateY(40px) scale(${zoom}) rotateX(${rot.x}deg) rotateY(${rot.y}deg)`, transition: reduced ? 'none' : 'transform .25s ease' }}>
        <div className={face} style={{ width: 420, height: 420, marginLeft: -210, marginTop: -210, transform: 'rotateX(90deg) translateZ(-1px)', background: 'repeating-linear-gradient(0deg,#232327 0 1px,transparent 1px 21px),repeating-linear-gradient(90deg,#232327 0 1px,transparent 1px 21px)' }} />
        <div className="absolute [transform-style:preserve-3d]" data-hl={sel === 'foundation'} style={show('foundation')}>
          <div className={face} style={{ width: W + 30, height: D + 30, marginLeft: -(W + 30) / 2, marginTop: -(D + 30) / 2, transform: 'rotateX(90deg) translateZ(12px)', background: '#8d8778' }} />
          <div className={face} style={{ width: W + 30, height: 12, marginLeft: -(W + 30) / 2, marginTop: -6, transform: `translateY(-6px) translateZ(${(D + 30) / 2}px)`, background: '#6f6a5e' }} />
        </div>
        <div className="absolute [transform-style:preserve-3d]" data-hl={sel === 'flooring'} style={show('flooring')}>
          <div className={face} style={{ width: W, height: D, marginLeft: -W / 2, marginTop: -D / 2, transform: 'rotateX(90deg) translateZ(14px)', background: 'repeating-linear-gradient(0deg,#F3ECDD 0 20px,#9c2f24 20px 34px)' }} />
        </div>
        <div className="absolute [transform-style:preserve-3d]" data-hl={sel === 'walls'} style={{ ...show('walls'), transform: `translateY(${-14 - H / 2}px)` }}>
          <div className={face} style={{ ...wall(`translateZ(${D / 2}px)`, W), background: '#F7F4EC' }}>
            <div className="absolute inset-0" data-hl={sel === 'openings'} style={show('openings')}>
              <div className="absolute bottom-0 left-1/2 -ml-[16px] h-[52px] w-[32px] rounded-t-full bg-[#3F7A3A]" />
              {[30, 70, 160, 200].map((x) => <div key={x} className="absolute top-[18px] h-[26px] w-[16px] rounded-t-full bg-[#0A0908]" style={{ left: x }} />)}
            </div>
          </div>
          <div className={face} style={{ ...wall(`rotateY(180deg) translateZ(${D / 2}px)`, W), background: '#EEEADF' }} />
          <div className={face} style={{ ...wall(`rotateY(90deg) translateZ(${W / 2}px)`, D), background: '#F2EEE4' }}>
            <div className="absolute inset-0" data-hl={sel === 'openings'} style={show('openings')}>{[40, 90, 140].map((x) => <div key={x} className="absolute top-[18px] h-[26px] w-[16px] rounded-t-full bg-[#0A0908]" style={{ left: x }} />)}</div>
          </div>
          <div className={face} style={{ ...wall(`rotateY(-90deg) translateZ(${W / 2}px)`, D), background: '#F2EEE4' }}>
            <div className="absolute inset-0" data-hl={sel === 'openings'} style={show('openings')}>{[40, 90, 140].map((x) => <div key={x} className="absolute top-[18px] h-[26px] w-[16px] rounded-t-full bg-[#0A0908]" style={{ left: x }} />)}</div>
          </div>
        </div>
        <div className="absolute [transform-style:preserve-3d]" data-hl={sel === 'roof'} style={{ ...show('roof'), transform: `translateY(${-14 - H}px)` }}>
          <div className={face} style={{ width: W + 12, height: D + 12, marginLeft: -(W + 12) / 2, marginTop: -(D + 12) / 2, transform: 'rotateX(90deg)', background: '#bdb6a5' }} />
        </div>
        <div className="absolute [transform-style:preserve-3d]" data-hl={sel === 'dome'} style={{ ...show('dome'), transform: `translateY(${-14 - H}px)` }}>
          {[0, 30, 60, 90, 120, 150].map((a) => (
            <div key={a} className={face} style={{ width: 110, height: 55, marginLeft: -55, marginTop: -55, transform: `rotateY(${a}deg)`, borderRadius: '110px 110px 0 0', background: 'rgba(212,42,47,0.92)', border: '1px solid rgba(11,11,12,0.08)' }} />
          ))}
          <div className={face} style={{ width: 3, height: 22, marginLeft: -1.5, marginTop: -78, background: '#D42A2F' }} />
        </div>
      </div>
    </div>
  );
}

function ZoomRig({ dist }: { dist: number }) {
  const camera = useThree((st) => st.camera);
  const target = useRef(new Vector3(0, 2.5, 0));
  useFrame(() => {
    const dir = camera.position.clone().sub(target.current);
    const cur = dir.length();
    if (Math.abs(cur - dist) < 0.01) return;
    dir.setLength(cur + (dist - cur) * 0.2);
    camera.position.copy(target.current).add(dir);
  });
  return null;
}

function NoGLNotice({ reason }: { reason: string }) {
  return (
    <div className="pointer-events-none absolute left-3 right-3 top-12 sm:right-auto sm:max-w-sm rounded-sm border border-paper/15 bg-ink/85 p-3 text-xs text-paper/75" role="status" data-testid="text-webgl-unavailable">
      <p className="meta text-paper">3D renderer unavailable</p>
      <p className="mt-1">{reason} Showing a simplified CSS 3D model instead. Stages, the simulation slider and documented progress work the same.</p>
    </div>
  );
}

const INK = '#0A0908'; const PAPER = '#F3ECDD'; const STONE = '#d9d3c5'; const VERM = '#D42A2F'; const WHITE = '#F7F4EC'; const GREEN = '#3F7A3A';

function Masjid({ active, reduced, sel }: { active: Set<Part>; reduced: boolean; sel: Part | null }) {
  const rot = useRef<Group>(null);
  useFrame((_, dt) => { if (rot.current && !reduced) rot.current.rotation.y += dt * 0.04; });
  const W = 10, D = 8, H = 3.2, T = 0.3;
  return (
    <group ref={rot}>
      <Grow on={active.has('foundation')} reduced={reduced} hl={sel === 'foundation'}>
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow><boxGeometry args={[W + 1.2, 0.5, D + 1.2]} /><meshStandardMaterial color={'#8d8778'} roughness={0.95} /></mesh>
      </Grow>
      <Grow on={active.has('flooring')} reduced={reduced} hl={sel === 'flooring'}>
        <mesh position={[0, 0.56, 0]} receiveShadow><boxGeometry args={[W, 0.12, D]} /><meshStandardMaterial color={PAPER} roughness={0.6} /></mesh>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={i} position={[0, 0.63, -D / 2 + 1 + i * 1.5]}><boxGeometry args={[W - 1, 0.02, 0.9]} /><meshStandardMaterial color={'#9c2f24'} roughness={0.9} /></mesh>
        ))}
      </Grow>
      <group position={[0, 0.62, 0]}>
        <Grow on={active.has('walls')} reduced={reduced} hl={sel === 'walls'}>
          <mesh position={[0, H / 2, -D / 2 + T / 2]} castShadow><boxGeometry args={[W, H, T]} /><meshStandardMaterial color={WHITE} /></mesh>
          <mesh position={[0, H / 2, D / 2 - T / 2]} castShadow><boxGeometry args={[W, H, T]} /><meshStandardMaterial color={WHITE} /></mesh>
          <mesh position={[-W / 2 + T / 2, H / 2, 0]} castShadow><boxGeometry args={[T, H, D]} /><meshStandardMaterial color={WHITE} /></mesh>
          <mesh position={[W / 2 - T / 2, H / 2, 0]} castShadow><boxGeometry args={[T, H, D]} /><meshStandardMaterial color={WHITE} /></mesh>
          <mesh position={[0, H * 0.55, -D / 2 + 0.05]}><boxGeometry args={[1.2, 2, 0.4]} /><meshStandardMaterial color={'#b9b2a1'} /></mesh>
        </Grow>
        <Grow on={active.has('openings')} reduced={reduced} hl={sel === 'openings'}>
          <mesh position={[0, 1.1, D / 2 + 0.01]}><boxGeometry args={[1.4, 2.2, 0.08]} /><meshStandardMaterial color={GREEN} /></mesh>
          {[-3.4, -1.9, 1.9, 3.4].map((x) => (
            <mesh key={x} position={[x, 2, D / 2 + 0.01]}><boxGeometry args={[0.7, 1.1, 0.06]} /><meshStandardMaterial color={INK} roughness={0.3} /></mesh>
          ))}
          {[-2.4, 0, 2.4].map((z) => (
            <group key={z}>
              <mesh position={[W / 2 + 0.01, 2, z]}><boxGeometry args={[0.06, 1.1, 0.7]} /><meshStandardMaterial color={INK} roughness={0.3} /></mesh>
              <mesh position={[-W / 2 - 0.01, 2, z]}><boxGeometry args={[0.06, 1.1, 0.7]} /><meshStandardMaterial color={INK} roughness={0.3} /></mesh>
            </group>
          ))}
        </Grow>
        <group position={[0, H, 0]}>
          <Grow on={active.has('roof')} reduced={reduced} hl={sel === 'roof'}>
            <mesh position={[0, 0.15, 0]} castShadow><boxGeometry args={[W + 0.4, 0.3, D + 0.4]} /><meshStandardMaterial color={'#c8c1b0'} /></mesh>
            <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[2.1, 2.3, 0.5, 32]} /><meshStandardMaterial color={STONE} /></mesh>
          </Grow>
          <Grow on={active.has('dome')} reduced={reduced} hl={sel === 'dome'}>
            <mesh position={[0, 0.75, 0]} castShadow><sphereGeometry args={[2.1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={VERM} roughness={0.35} metalness={0.05} /></mesh>
            <mesh position={[0, 3.05, 0]}><cylinderGeometry args={[0.04, 0.04, 0.6, 8]} /><meshStandardMaterial color={VERM} /></mesh>
            <mesh position={[W / 2 - 0.4, 1.8, D / 2 - 0.4]} castShadow><cylinderGeometry args={[0.35, 0.42, 3.6, 16]} /><meshStandardMaterial color={STONE} /></mesh>
            <mesh position={[W / 2 - 0.4, 3.9, D / 2 - 0.4]}><coneGeometry args={[0.42, 0.9, 16]} /><meshStandardMaterial color={PAPER} /></mesh>
          </Grow>
        </group>
      </group>
    </group>
  );
}

export default function VisualBuild() {
  const search = useSearch();
  const projectId = new URLSearchParams(search).get('projectId') ?? undefined;
  const params = projectId ? { projectId } : undefined;
  const q = useGetVisualBuild(params, { query: { queryKey: getGetVisualBuildQueryKey(params) } });
  const [sim, setSim] = useState(0);
  const [sel, setSel] = useState<Part | null>(null);
  const [dist, setDist] = useState(23);
  const cssZoom = Math.max(0.6, Math.min(1.8, 23 / dist));
  const zoomBy = (d: number) => setDist((v) => Math.max(10, Math.min(38, v + d)));
  const reset = () => { setSim(0); setSel(null); setDist(23); };
  const reduced = useReducedMotion();
  const [webgl] = useState(detectWebGL);
  const stages: VisualBuildStagesItem[] = useMemo(() => [...(q.data?.stages ?? [])].sort((a, b) => a.threshold - b.threshold), [q.data]);
  const active = useMemo(() => new Set(stages.filter((s) => sim >= s.threshold).map((s, i) => partFor(s.name, i))), [stages, sim]);
  const reached = stages.filter((s) => sim >= s.threshold).length;

  return (
    <Page dark>
      <section className="mx-auto max-w-7xl px-5 py-10 md:py-14">
        <Kicker className="text-paper/60">Visual Build / conceptual</Kicker>
        <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold tracking-tight">{q.data?.title ?? 'Visual Build'}</h1>
        <p className="mt-3 max-w-2xl text-paper/70">A conceptual masjid that assembles as stage thresholds are crossed. The slider below is a simulation. It does not show actual funding or construction.</p>

        {q.isError && <div className="mt-8 text-ink"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="relative h-[56dvh] min-h-[340px] rounded-md overflow-hidden border border-paper/10 bg-[radial-gradient(ellipse_at_50%_40%,#232327_0%,#0A0908_70%)]" data-testid="canvas-visual-build">
            {q.isLoading ? <Block className="absolute inset-0 bg-paper/5" /> : !webgl ? (
              <><CssMasjid active={active} reduced={reduced} sel={sel} zoom={cssZoom} /><NoGLNotice reason="This browser or device could not create a WebGL context." /></>
            ) : (
              <GLBoundary fallback={<><CssMasjid active={active} reduced={reduced} sel={sel} zoom={cssZoom} /><NoGLNotice reason="The WebGL renderer failed to start." /></>}>
                <Canvas shadows camera={{ position: [14, 10, 16], fov: 38 }} dpr={[1, 2]} aria-label="Interactive 3D conceptual masjid. Drag to orbit, scroll to zoom.">
                  <ambientLight intensity={0.55} />
                  <directionalLight position={[10, 16, 8]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
                  <pointLight position={[0, 6, 10]} intensity={12} color={VERM} distance={22} />
                  <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[20, 64]} /><meshStandardMaterial color={'#141416'} /></mesh>
                  <gridHelper args={[40, 40, '#3a3a3f', '#232327']} position={[0, 0.01, 0]} />
                  <Masjid active={active} reduced={reduced} sel={sel} />
                  <ZoomRig dist={dist} />
                  <OrbitControls enablePan={false} enableZoom={false} minDistance={8} maxDistance={40} maxPolarAngle={Math.PI / 2.1} target={[0, 2.5, 0]} />
                </Canvas>
              </GLBoundary>
            )}
            <div className="pointer-events-none absolute left-3 top-3 rounded-sm bg-vermilion px-2.5 py-1 font-mono text-xs font-bold tracking-widest text-white">{webgl ? 'SIMULATION' : 'SIMULATION / CSS 3D FALLBACK'}</div>
            <div className="pointer-events-none absolute right-3 bottom-3 meta text-paper/50">{webgl ? 'Drag to orbit / scroll to zoom' : 'Drag or arrow keys to rotate'}</div>
          </div>

          <div className="space-y-5">
            <div className="rounded-md border-2 border-vermilion/70 p-5">
              <div className="flex items-center justify-between">
                <label htmlFor="sim" className="font-mono text-xs font-bold tracking-widest text-vermilion">SIMULATION</label>
                <span className="font-display text-3xl font-bold" data-testid="text-sim-value">{sim}%</span>
              </div>
              <input id="sim" type="range" min={0} max={100} value={sim} onChange={(e) => setSim(Number(e.target.value))} className="mt-4 w-full accent-[#D42A2F]" aria-valuetext={`Simulated ${sim} percent. Not actual funding.`} data-testid="slider-simulation" />
              <p className="mt-2 text-xs text-paper/60">Simulated value only. Not actual funding. Not actual construction.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={reset} className="btn-outline h-9 px-3 text-xs" data-testid="button-reset-build"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
                <button type="button" onClick={() => zoomBy(-3)} aria-label="Zoom in" className="btn-outline h-9 px-3 text-xs" data-testid="button-build-zoom-in"><Plus className="h-3.5 w-3.5" />Zoom</button>
                <button type="button" onClick={() => zoomBy(3)} aria-label="Zoom out" className="btn-outline h-9 px-3 text-xs" data-testid="button-build-zoom-out"><Minus className="h-3.5 w-3.5" />Zoom</button>
              </div>
              <p className="mt-3 meta text-paper/45">{reached} of {stages.length} components funded in the simulation</p>
            </div>

            <div className="invert-surface rounded-md bg-paper-2 border border-ink/15 text-ink p-5" data-testid="panel-documented-progress">
              <p className="meta text-vermilion-deep">Funding progress is not construction progress</p>
              <p className="mt-2 meta text-ink/55">Documented progress</p>
              {q.isLoading ? <Block className="mt-3 h-10" /> : q.data?.documentedProgress ? (
                <>
                  <p className="mt-2 text-sm leading-relaxed">{q.data.documentedProgress}</p>
                  {q.data.sourceUrl && <a href={q.data.sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block font-mono text-xs underline">Source</a>}
                </>
              ) : <p className="mt-2 text-sm">No documented construction evidence.</p>}
              <div className="mt-4 border-t border-ink/10 pt-3">
                <p className="meta text-ink/55">Reported funding</p>
                <p className="mt-1 text-sm">{q.data?.fundingPercent !== null && q.data?.fundingPercent !== undefined ? `${q.data.fundingPercent}% (from server record)` : 'No funding figure recorded.'}</p>
              </div>
              {q.data?.conceptual && <p className="mt-3 meta text-ink/55">Conceptual model, not a humanitarian project.</p>}
            </div>
          </div>
        </div>

        <div className="tz mt-10" aria-hidden />
        <h2 className="mt-6 font-display text-2xl font-bold">Components</h2>
        <p className="mt-1 meta text-paper/50">Select a component to highlight it. Thresholds come from the server and are hypothetical.</p>
        <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" role="group" aria-label="Building components">
          {stages.map((st, i) => {
            const part = partFor(st.name, i);
            const on = sim >= st.threshold;
            return (
              <button key={st.name + i} type="button" aria-pressed={sel === part} onClick={() => setSel(sel === part ? null : part)}
                className={cn('text-left rounded-md border p-3 transition-shadow', sel === part ? 'border-vermilion shadow-[0_0_24px_rgba(212,42,47,0.45)]' : 'border-paper/15 hover:border-vermilion/60')} data-testid={`button-part-${part}`}>
                <span className="flex items-center gap-2 font-display font-semibold"><span className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-vermilion' : 'bg-paper/25')} />{st.name}</span>
                <span className="mt-1 block meta text-paper/50">at {st.threshold}%</span>
              </button>
            );
          })}
          {!q.isLoading && stages.length === 0 && <p className="text-sm text-paper/60 col-span-full">No stages were returned by the server.</p>}
        </div>
        {sel && (() => {
          const idx = stages.findIndex((st, i) => partFor(st.name, i) === sel);
          const st = stages[idx];
          return (
            <p className="mt-4 rounded-md border border-paper/15 bg-ink-2 p-4 text-sm" aria-live="polite" data-testid="text-part-description">
              <span className="font-semibold">{st?.name ?? sel}:</span> {DESC[sel]}{st ? ` Appears at ${st.threshold}% simulated funding (hypothetical threshold).` : ''}{st && sim < st.threshold ? ' Not shown at the current simulation value.' : ''}
            </p>
          );
        })()}
      </section>
    </Page>
  );
}
