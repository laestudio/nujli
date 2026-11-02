/** Secure normalizer for official YouTube/Vimeo embeds. Exact host whitelist only. */
export type VideoSource =
  | { kind: 'youtube'; id: string; embedUrl: string; watchUrl: string }
  | { kind: 'vimeo'; id: string; embedUrl: string; watchUrl: string }
  | { kind: 'file'; url: string }
  | { kind: 'invalid'; reason: string };

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{1,12}$/;
const FILE_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)$/i;

function yt(id: string | null | undefined): VideoSource {
  if (!id || !YT_ID.test(id)) return { kind: 'invalid', reason: 'The YouTube link does not contain a valid video ID.' };
  return { kind: 'youtube', id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`, watchUrl: `https://www.youtube.com/watch?v=${id}` };
}
function vimeo(id: string | undefined): VideoSource {
  if (!id || !VIMEO_ID.test(id)) return { kind: 'invalid', reason: 'The Vimeo link does not contain a valid video ID.' };
  return { kind: 'vimeo', id, embedUrl: `https://player.vimeo.com/video/${id}?dnt=1&playsinline=1`, watchUrl: `https://vimeo.com/${id}` };
}

export function normalizeVideo(raw: string | null | undefined): VideoSource {
  if (!raw) return { kind: 'invalid', reason: 'No video address was provided.' };
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return { kind: 'invalid', reason: 'The video address is not a valid URL.' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { kind: 'invalid', reason: 'Unsupported video address.' };
  if (u.username || u.password || (u.port && u.port !== '443' && u.port !== '80')) return { kind: 'invalid', reason: 'Unsupported video address.' };
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') return yt(parts[0]);
  if (YT_HOSTS.has(host)) {
    if (parts[0] === 'watch') return yt(u.searchParams.get('v'));
    if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')) return yt(parts[1]);
    return { kind: 'invalid', reason: 'This YouTube address is not a single video.' };
  }
  if (VIMEO_HOSTS.has(host)) {
    if (host === 'player.vimeo.com') return parts[0] === 'video' ? vimeo(parts[1]) : { kind: 'invalid', reason: 'This Vimeo address is not a single video.' };
    return vimeo(parts.find((p) => VIMEO_ID.test(p)));
  }
  if (u.protocol === 'https:' && FILE_EXT.test(u.pathname)) return { kind: 'file', url: u.toString() };
  if (u.protocol === 'https:' && !/youtube|youtu\.be|vimeo/i.test(host)) return { kind: 'file', url: u.toString() };
  return { kind: 'invalid', reason: 'This video host is not supported for embedding.' };
}
