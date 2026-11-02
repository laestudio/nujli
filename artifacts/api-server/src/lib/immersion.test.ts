import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SaveProjectBody } from "@workspace/api-zod";
import { hasDocumentedDate, saveRevision, getProject, type Revision } from "./projects";
import { emptyImmersion, publicImmersion, remapImmersion, validateImmersion } from "./immersion";

const sourceUrl = "https://example.org/sample";
const quote = "SAMPLE comparison records images on 2026-01-01 and 2026-02-01.";
const corpus = `SAMPLE project. ${quote}`;
function fixture(): Revision {
  return {
    title: "SAMPLE project", overview: quote, cause: "SAMPLE", locationName: "SAMPLE", latitude: null, longitude: null,
    claims: [{ id: "c1", text: quote, quote, sourceUrl, label: "Organization Reported", reviews: [] }],
    statistics: [], updates: [],
    media: ["m1", "m2"].map(id => ({ id, url: `https://example.org/${id}.jpg`, type: "image", caption: "SAMPLE image", permissionStatus: "approved", sourceUrl })),
    immersion: {
      scenes: ["m1", "m2"].map((mediaId, i) => ({
        mediaId, panoramaConfirmed: i === 0, date: i === 0 ? "2026-01-01" : "2026-02-01", dateQuote: quote,
        hotspots: [{ id: `h${i}`, kind: "claim", recordId: "c1", x: 50, y: 50, confirmed: true, limitations: "SAMPLE organization claim, not an independent review." }],
      })),
      comparisons: [{ beforeMediaId: "m1", afterMediaId: "m2", claimId: "c1", confirmed: true }],
    },
  };
}
const validate = (r: Revision) => validateImmersion(r, { [sourceUrl]: corpus }, hasDocumentedDate);

test("immersive contract rejects out-of-range coordinates and empty limitations", () => {
  const r = fixture();
  assert.equal(SaveProjectBody.safeParse(r).success, true);
  r.immersion!.scenes[0]!.hotspots[0]!.x = 101;
  assert.equal(SaveProjectBody.safeParse(r).success, false);
  r.immersion!.scenes[0]!.hotspots[0]!.x = 50;
  r.immersion!.scenes[0]!.hotspots[0]!.limitations = "";
  assert.equal(SaveProjectBody.safeParse(r).success, false);
});

test("confirmed scenes and hotspots require authorized same-project evidence", () => {
  assert.doesNotThrow(() => validate(fixture()));
  for (const change of [
    (r: Revision) => { r.immersion!.scenes[0]!.mediaId = "other-project"; },
    (r: Revision) => { r.immersion!.scenes[0]!.hotspots[0]!.recordId = "missing"; },
    (r: Revision) => { r.media[0]!.permissionStatus = "pending"; },
    (r: Revision) => { r.media[0]!.type = "video"; },
    (r: Revision) => { r.immersion!.scenes.push(r.immersion!.scenes[0]!); },
    (r: Revision) => { r.immersion!.scenes[1]!.hotspots[0]!.id = "h0"; },
    (r: Revision) => {
      r.media[1]!.permissionStatus = "rejected";
      r.immersion!.scenes[0]!.hotspots[0] = { ...r.immersion!.scenes[0]!.hotspots[0]!, kind: "media", recordId: "m2" };
    },
  ]) {
    const r = fixture(); change(r);
    assert.throws(() => validate(r));
  }
});

test("comparison dates must be chronological and documented in the actual media source and comparison claim", () => {
  for (const change of [
    (r: Revision) => { r.immersion!.scenes[0]!.date = "2026-03-01"; },
    (r: Revision) => { r.immersion!.scenes[0]!.dateQuote = "Invented quotation 2026-01-01"; },
    (r: Revision) => { r.immersion!.scenes[0]!.date = null; },
    (r: Revision) => { r.immersion!.comparisons[0]!.beforeMediaId = "m2"; },
    (r: Revision) => { r.claims[0]!.quote = "SAMPLE unrelated project evidence."; },
    (r: Revision) => { r.media[0]!.sourceUrl = "https://example.org/different-source"; },
  ]) {
    const r = fixture(); change(r);
    assert.throws(() => validate(r));
  }
});

test("public projection removes withheld, stale and unconfirmed evidence without upgrading labels", () => {
  const r = fixture();
  r.immersion!.scenes[0]!.hotspots[0]!.confirmed = false;
  const output = publicImmersion(r.immersion!, new Set(["m1"]), new Set(["c1"]));
  assert.equal(output.scenes.length, 1);
  assert.equal(output.scenes[0]!.hotspots.length, 0);
  assert.equal(output.comparisons.length, 0);
  assert.equal(r.claims[0]!.label, "Organization Reported");
  assert.deepEqual(publicImmersion(r.immersion!, new Set(), new Set()), emptyImmersion());
});

test("all references remap atomically when saved record IDs change", () => {
  const r = fixture();
  const result = remapImmersion(r.immersion!, new Map([["m1", "new1"], ["m2", "new2"]]), new Map([["c1", "newClaim"]]));
  assert.equal(result.scenes[0]!.mediaId, "new1");
  assert.equal(result.scenes[0]!.hotspots[0]!.recordId, "newClaim");
  assert.equal(result.comparisons[0]!.afterMediaId, "new2");
  assert.throws(() => remapImmersion(r.immersion!, new Map(), new Map()));
});

test("database round-trip preserves evidence, isolation and review semantics; generation clears confirmations", async () => {
  const owner = `SAMPLE-immersion-${randomUUID()}`;
  let orgId: string | undefined;
  let projectId: string | undefined;
  try {
    const org = await pool.query("INSERT INTO organizations(owner_id,name,website) VALUES($1,'SAMPLE immersion test','https://example.org') RETURNING id", [owner]);
    orgId = org.rows[0].id;
    const project = await pool.query("INSERT INTO projects(organization_id,source_url,source_text,is_sample) VALUES($1,$2,$3,true) RETURNING id", [orgId,sourceUrl,corpus]);
    projectId = project.rows[0].id;
    const initial = fixture(); initial.immersion = emptyImmersion();
    const saved = await saveRevision(projectId!, orgId!, initial, owner);
    const revision = fixture();
    revision.claims = saved.claims;
    revision.media = saved.media;
    revision.immersion = remapImmersion(fixture().immersion!,
      new Map([["m1", saved.media.find(m => m.url.endsWith("m1.jpg"))!.id], ["m2", saved.media.find(m => m.url.endsWith("m2.jpg"))!.id]]),
      new Map([["c1", saved.claims[0]!.id]]));
    const confirmed = await saveRevision(projectId!, orgId!, revision, owner);
    assert.equal(confirmed.immersion!.scenes[0]!.hotspots[0]!.recordId, confirmed.claims[0]!.id);
    assert.equal(confirmed.claims[0]!.label, "Organization Reported");
    assert.equal(confirmed.status, "draft");
    assert.equal(confirmed.publishedAt, null);
    await assert.rejects(getProject(projectId!, { public: true }));
    await assert.rejects(saveRevision(projectId!, randomUUID(), confirmed, owner));
    const changed = structuredClone(confirmed);
    changed.media[0]!.url = "https://example.org/substituted.jpg";
    await assert.rejects(saveRevision(projectId!, orgId!, changed, owner), /Save media corrections/);
    const reread = await getProject(projectId!, { organizationId: orgId });
    assert.equal(reread.media[0]!.url, confirmed.media[0]!.url);
    const generated = await saveRevision(projectId!, orgId!, confirmed, owner, randomUUID(),
      { sourceUrl, corpus, hash: "SAMPLE", warnings: [], sources: { [sourceUrl]: corpus } });
    assert.deepEqual(generated.immersion, emptyImmersion());
  } finally {
    if (projectId) await pool.query("DELETE FROM projects WHERE id=$1", [projectId]);
    if (orgId) await pool.query("DELETE FROM organizations WHERE id=$1", [orgId]);
    await pool.query("DELETE FROM audit_events WHERE actor_id=$1", [owner]);
  }
});
