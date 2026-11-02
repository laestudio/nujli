import { Page } from '@/components/shell';
import { ClaimLabelBadge, Kicker } from '@/components/states';

const LABELS = [
  { l: 'Organization Reported' as const, d: 'The organization states this on a public web page. nujli. stores the exact quoted sentence and the URL it came from. No one outside the organization has checked it.', need: 'Claim text, source URL, verbatim quote.' },
  { l: 'Corroborated' as const, d: 'The claim is supported by at least one public source that is separate from the organization, such as a partner, authority or press report, and that source is linked and quoted.', need: 'Everything above, plus an independent public source.' },
  { l: 'Independently Reviewed' as const, d: 'An authorized nujli. reviewer, who has declared no conflict of interest, examined evidence and recorded written findings, limitations and evidence links. The review is shown in full beside the claim.', need: 'A recorded review with findings, limitations and at least one evidence URL.' },
];

const RULES = [
  ['Statistic', 'A figure with a label, value and unit, tied to a claim, a source URL and the quote it was taken from. Its as-of date is the date the source says the figure applies to. If the source gives no date, the statistic is marked Undated.'],
  ['Since your last donation', 'A filter that runs in your browser. Updates are shown when their date is on or after the date you choose. Statistics are shown only when their as-of date is on or after that date. Undated statistics are never counted as new.'],
  ['Update', 'A dated event from the source page with a title, body, quote and link. Updates without a date are not placed on the timeline.'],
  ['Media', 'A photo or video found on the source page. Each item is hidden from the public until the organization confirms permission for that specific item.'],
  ['Approval', 'The organization confirms the content is accurate, that media permissions are in place, and that no beneficiary or private personal data is shown. Approval is separate from publishing.'],
  ['Editing', 'Any saved edit resets approval and unpublishes the page on the server. It must be approved and published again.'],
  ['Automation', 'Extraction drafts are produced with an AI model configured by nujli. The model never assigns trust labels and never marks anything as verified.'],
  ['Visual Build', 'A conceptual 3D model with a slider labeled SIMULATION. It does not represent actual funding or construction. Documented progress is shown separately and only when a source exists.'],
];

export default function Methodology() {
  return (
    <Page>
      <section className="mx-auto max-w-5xl px-5 py-16 md:py-24">
        <Kicker className="text-ink/55">Methodology</Kicker>
        <h1 className="mt-4 font-display text-4xl md:text-6xl font-bold tracking-tight max-w-3xl leading-[0.98]">What every label on nujli. means, exactly.</h1>
        <p className="mt-6 max-w-2xl text-lg text-ink/75">These definitions are the contract. If a claim does not meet one, it is not shown with that label. Sources and quotes are required and enforced on the server.</p>

        <div className="mt-14 space-y-px bg-ink/10 border border-ink/10">
          {LABELS.map(({ l, d, need }) => (
            <div key={l} className="bg-paper p-6 md:p-8 grid gap-4 md:grid-cols-[240px_1fr]" data-testid={`definition-${l}`}>
              <div><ClaimLabelBadge label={l} /></div>
              <div>
                <p className="leading-relaxed">{d}</p>
                <p className="mt-3 meta text-ink/55">Requires: {need}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-20 font-display text-3xl font-bold">Definitions</h2>
        <dl className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
          {RULES.map(([t, d]) => (
            <div key={t} className="py-5 grid gap-2 md:grid-cols-[240px_1fr]">
              <dt className="font-display font-semibold">{t}</dt>
              <dd className="text-ink/80 leading-relaxed">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 meta text-ink/55">nujli. never displays labels such as "AI verified". There is no such status.</p>
      </section>
    </Page>
  );
}
