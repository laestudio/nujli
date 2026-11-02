import type { Project } from '@workspace/api-client-react';

export function DemoNotice({ demonstration }: { demonstration: Project['demonstration'] }) {
  if (!demonstration) return null;
  return (
    <aside className="my-4 rounded-md border border-current/25 p-3 text-sm leading-relaxed" data-testid="demo-disclosure">
      <p className="font-semibold">{demonstration.disclosure}</p>
      <a href={demonstration.registryUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block underline underline-offset-4">{demonstration.attribution}</a>
      <p className="mt-2 text-xs">Published by nujli. as an independent demonstration. Organization Reported · {demonstration.license}</p>
    </aside>
  );
}
