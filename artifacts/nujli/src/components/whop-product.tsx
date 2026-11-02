import { ArrowUpRight } from 'lucide-react';

const productUrl = 'https://whop.com/nujli-2/nujli-annual-impact-revealed/';

export function WhopProduct({ linkedCheckoutReady = false }: { linkedCheckoutReady?: boolean }) {
  return (
    <section className="mt-8 min-w-0 overflow-hidden rounded-md border border-ink/15" aria-labelledby="whop-product-title" data-testid="whop-product">
      <div className="space-y-3 p-5">
        <h2 id="whop-product-title" className="font-display text-2xl font-bold">nujli. on Whop</h2>
        <p className="text-sm text-ink/70">View our official product below. Complete payment on Whop in a new tab.</p>
        {!linkedCheckoutReady ? <p className="text-sm text-vermilion-deep" role="note">
          Automatic payment verification is currently unavailable. A purchase directly on Whop will not automatically unlock this organization’s workspace. Please wait until verification is restored before purchasing for access.
        </p> : <p className="text-sm text-ink/70" role="note">To link your purchase to this organization, use “Continue to checkout” below rather than purchasing from the product preview.</p>}
        <a href={productUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-ink px-5 py-3 text-sm font-medium text-paper" data-testid="link-whop-product">
          Open on Whop <ArrowUpRight className="h-4 w-4" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <p id="whop-preview-help" className="text-xs text-ink/60">If the preview is blank or Whop asks you to sign in, use “Open on Whop” above.</p>
      </div>
      <iframe
        src={productUrl}
        title="Official nujli. Whop product preview"
        aria-describedby="whop-preview-help"
        className="block h-[640px] w-full border-0 bg-white md:h-[760px]"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
        data-testid="iframe-whop-product"
      />
    </section>
  );
}
