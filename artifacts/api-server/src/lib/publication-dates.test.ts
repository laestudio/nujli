import { test } from "node:test";
import assert from "node:assert/strict";
import { recordPublication, withPublicationDates } from "./publication-dates";

test("first publication is server-owned, not the event date or an organization-supplied date", () => {
  const update = { id: "SAMPLE", title: "SAMPLE update", date: "2000-01-01", body: "SAMPLE quote", quote: "SAMPLE quote", sourceUrl: "https://example.org", publishedAt: "2099-01-01" };
  const project = { claims: [], statistics: [], updates: [update], media: [] };
  const ledger = recordPublication(project, {}, "2026-10-01T12:00:00Z");
  assert.equal(withPublicationDates("updates", project.updates, ledger)[0]!.publishedAt, "2026-10-01T12:00:00Z");
  assert.equal(withPublicationDates("updates", project.updates, {})[0]!.publishedAt, null);
});

test("republishing unchanged evidence with new IDs never makes it newly reported", () => {
  const claim = { id: "SAMPLE-old", text: "SAMPLE text", quote: "SAMPLE text", sourceUrl: "https://example.org" };
  const project = { claims: [claim], statistics: [], updates: [], media: [] };
  const ledger = recordPublication(project, {}, "2026-01-01T00:00:00Z");
  project.claims[0] = { ...claim, id: "SAMPLE-new" };
  const republished = recordPublication(project, ledger, "2026-10-01T00:00:00Z");
  assert.equal(withPublicationDates("claims", project.claims, republished)[0]!.publishedAt, "2026-01-01T00:00:00Z");
  project.claims[0] = { ...claim, text: "SAMPLE changed text", quote: "SAMPLE changed text" };
  assert.equal(withPublicationDates("claims", project.claims, republished)[0]!.publishedAt, null);
  assert.equal(withPublicationDates("claims", project.claims, recordPublication(project, republished, "2026-11-01T00:00:00Z"))[0]!.publishedAt, "2026-11-01T00:00:00Z");
});

test("withheld media receives no publication timestamp", () => {
  const media = { url: "https://example.org/sample.jpg", sourceUrl: "https://example.org", type: "image", caption: "SAMPLE", permissionStatus: "pending" };
  const project = { claims: [], statistics: [], updates: [], media: [media] };
  const ledger = recordPublication(project, {}, "2026-01-01T00:00:00Z");
  assert.deepEqual(ledger, {});
  project.media[0]!.permissionStatus = "approved";
  const published = recordPublication(project, ledger, "2026-11-01T00:00:00Z");
  assert.equal(withPublicationDates("media", project.media, published)[0]!.publishedAt, "2026-11-01T00:00:00Z");
});
