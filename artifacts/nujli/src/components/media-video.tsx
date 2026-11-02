import { useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Play, VideoOff } from 'lucide-react';
import { normalizeVideo } from '@/lib/video-embed';
import { cn } from '@/lib/utils';

/** Context note shown with every video: publisher footage is context, not proof. */
export const VIDEO_CONTEXT_NOTE = 'Video published by the organization or its publisher. Shown as context only; it is not proof of any IATI financial transaction, outcome, or what a donation paid for.';

export function MediaContextNote({ caption, permission, dark }: { caption?: string | null; permission?: string | null; dark?: boolean }) {
  return (
    <p className={cn('text-xs leading-snug', dark ? 'text-paper/60' : 'text-ink/70')} data-testid="text-media-context">
      <span className="font-mono uppercase tracking-wide mr-1">Context</span>
      {caption ? <>Media description: {caption} </> : 'No caption published. '}
      {permission === 'approved' ? 'Display permission recorded; this is not organization endorsement. ' : 'Display permission not confirmed. '}
      No attribution of funding is implied.
    </p>
  );
}

export function MediaVideo({ url, sourceUrl, title, dark, className, testId }: { url: string; sourceUrl?: string | null; title: string; dark?: boolean; className?: string; testId?: string }) {
  const src = useMemo(() => normalizeVideo(url), [url]);
  const [activated, setActivated] = useState(false);
  const [failed, setFailed] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [fullscreenError, setFullscreenError] = useState('');
  const external = src.kind === 'youtube' || src.kind === 'vimeo' ? src.watchUrl : (sourceUrl || (src.kind === 'file' ? src.url : ''));
  const linkCls = cn('inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-2', dark ? 'text-paper' : 'text-ink');
  const altLink = external ? (
    <a href={external} target="_blank" rel="noreferrer noopener" className={linkCls} data-testid="link-video-external">
      Open on {src.kind === 'youtube' ? 'YouTube' : src.kind === 'vimeo' ? 'Vimeo' : 'source'}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
    </a>
  ) : null;

  let stage: React.ReactNode;
  if (src.kind === 'invalid' || failed) {
    stage = (
      <div role="alert" className="absolute inset-0 grid place-items-center p-5 text-center text-sm text-paper/85">
        <div><VideoOff className="mx-auto mb-2 h-6 w-6" aria-hidden />{failed ? 'This video could not be played here.' : src.kind === 'invalid' ? src.reason : ''} Use the external link below.</div>
      </div>
    );
  } else if (src.kind === 'file') {
    stage = <video src={src.url} controls playsInline preload="metadata" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full bg-ink" data-testid={testId}>Your browser cannot play this video.</video>;
  } else if (!activated) {
    stage = (
      <button type="button" onClick={() => setActivated(true)} className="absolute inset-0 grid place-items-center text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-vermilion" aria-label={`Load and play ${src.kind === 'youtube' ? 'YouTube' : 'Vimeo'} video: ${title}`} data-testid={testId ? `${testId}-play` : 'button-video-play'}>
        <span className="flex flex-col items-center gap-2">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-paper/50 bg-ink/60"><Play className="h-6 w-6" aria-hidden /></span>
          <span className="text-xs text-paper/75 px-4">Loads the official {src.kind === 'youtube' ? 'YouTube (privacy mode)' : 'Vimeo (do-not-track)'} player</span>
        </span>
      </button>
    );
  } else {
    stage = (
      <iframe
        src={`${src.embedUrl}&autoplay=1`}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        data-testid={testId}
      />
    );
  }

  return (
    <div ref={fullscreenRef} className={cn(className, 'bg-ink fullscreen:flex fullscreen:flex-col fullscreen:justify-center fullscreen:p-4 fullscreen:overflow-y-auto')}>
      <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-ink">{stage}</div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4">
        {altLink}
        <button type="button" className={cn(linkCls, 'px-2')} onClick={async () => {
          try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else if (fullscreenRef.current?.requestFullscreen) await fullscreenRef.current.requestFullscreen();
            else setFullscreenError('Fullscreen is not available in this browser. Use the video provider’s controls or source link.');
          } catch { setFullscreenError('Fullscreen was blocked by your browser. The video and source link remain available.'); }
        }}>Toggle fullscreen</button>
      </div>
      {activated && <p className={cn('text-xs py-2', dark ? 'text-paper/80' : 'text-ink/80')}>If the player asks you to sign in or cannot play here, open it on the provider’s site above.</p>}
      {fullscreenError && <p role="status" className="text-sm text-paper">{fullscreenError}</p>}
    </div>
  );
}
