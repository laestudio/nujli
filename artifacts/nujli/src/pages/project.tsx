import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Clock, RotateCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetPublicProject, getGetPublicProjectQueryKey } from '@workspace/api-client-react';
import { Page } from '@/components/shell';
import { ProjectView } from '@/components/project-view';
import { Empty, ErrorState, PageSkeleton } from '@/components/states';
import { errStatus } from '@/lib/format';

const SLOW_MS = 8000;
const TIMEOUT_MS = 20000;

export default function PublicProject() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useGetPublicProject(id, { query: { queryKey: getGetPublicProjectQueryKey(id), enabled: !!id, retry: (n, e) => errStatus(e) !== 404 && n < 2 } });
  const [phase, setPhase] = useState<'ok' | 'slow' | 'timeout'>('ok');
  const [retryCount, setRetryCount] = useState(0);
  const loading = q.isLoading || (q.isFetching && !q.data && !q.isError);

  // Timeout state persists until an explicit retry or a successful load.
  useEffect(() => {
    if (q.data) setPhase('ok');
  }, [q.data]);
  useEffect(() => {
    if (!loading) return;
    const a = window.setTimeout(() => setPhase('slow'), SLOW_MS);
    const b = window.setTimeout(() => { setPhase('timeout'); void qc.cancelQueries({ queryKey: getGetPublicProjectQueryKey(id) }); }, TIMEOUT_MS);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, [loading, id, qc, retryCount]);

  const retry = () => { setPhase('ok'); setRetryCount((n) => n + 1); void q.refetch(); };

  return (
    <Page>
      <div className="mx-auto max-w-6xl px-5 pt-5">
        <Link href="/explore" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink/80 hover:text-ink" data-testid="link-back-map"><ArrowLeft className="h-4 w-4" aria-hidden />Back to map</Link>
      </div>
      {phase === 'timeout' && !q.data && !q.isError ? (
        <div className="mx-auto max-w-3xl px-5 py-16" role="alert" data-testid="state-timeout">
          <Empty kicker="Network" title="This page is taking too long to load." action={<button type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4 text-paper font-medium" data-testid="button-retry-timeout"><RotateCw className="h-4 w-4" aria-hidden />Try again</button>}>
            We stopped waiting after {TIMEOUT_MS / 1000} seconds. Your connection may be slow, or the server is busy.
          </Empty>
        </div>
      ) : (
        <>
          {loading && <PageSkeleton />}
          {loading && phase === 'slow' && (
            <div className="mx-auto max-w-6xl px-5 -mt-6 pb-10" role="status" data-testid="state-slow">
              <p className="flex flex-wrap items-center gap-3 text-sm"><Clock className="h-4 w-4" aria-hidden />Still loading. This is slower than usual.
                <button type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-1.5 font-medium underline"><RotateCw className="h-4 w-4" aria-hidden />Retry now</button></p>
            </div>
          )}
          {q.isError && (
            <div className="mx-auto max-w-3xl px-5 py-16">
              {errStatus(q.error) === 404
                ? <Empty kicker="404" title="This Impact Page is not published.">It may have been unpublished by its organization, or the link is wrong.</Empty>
                : <ErrorState error={q.error} onRetry={() => q.refetch()} />}
            </div>
          )}
          {q.data && <ProjectView project={q.data} />}
        </>
      )}
    </Page>
  );
}
