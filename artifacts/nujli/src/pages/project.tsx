import { Link, useParams } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { useGetPublicProject, getGetPublicProjectQueryKey } from '@workspace/api-client-react';
import { Page } from '@/components/shell';
import { ProjectView } from '@/components/project-view';
import { Empty, ErrorState, PageSkeleton } from '@/components/states';
import { errStatus } from '@/lib/format';

export default function PublicProject() {
  const { id = '' } = useParams<{ id: string }>();
  const q = useGetPublicProject(id, { query: { queryKey: getGetPublicProjectQueryKey(id), enabled: !!id, retry: (n, e) => errStatus(e) !== 404 && n < 2 } });
  return (
    <Page>
      <div className="mx-auto max-w-6xl px-5 pt-5">
        <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm text-ink/70 hover:text-ink" data-testid="link-back-map"><ArrowLeft className="h-4 w-4" />Back to map</Link>
      </div>
      {q.isLoading && <PageSkeleton />}
      {q.isError && (
        <div className="mx-auto max-w-3xl px-5 py-16">
          {errStatus(q.error) === 404
            ? <Empty kicker="404" title="This Impact Page is not published.">It may have been unpublished by its organization, or the link is wrong.</Empty>
            : <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        </div>
      )}
      {q.data && <ProjectView project={q.data} />}
    </Page>
  );
}
