import { pool } from "@workspace/db";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { GetPublicProjectResponse, SaveProjectBody } from "@workspace/api-zod";
import { z } from "zod";
import { HttpError, requireCondition } from "./errors";
import { safeUrl } from "./safe-fetch";
import { emptyImmersion, publicImmersion, remapImmersion, validateImmersion } from "./immersion";
import { withPublicationDates } from "./publication-dates";

export type Revision = z.infer<typeof SaveProjectBody>;
export const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
export function hasDocumentedDate(quote:string,date:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const value=new Date(`${date}T00:00:00Z`);
  if(!Number.isFinite(value.getTime())||value.toISOString().slice(0,10)!==date)return false;
  if(quote.includes(date))return true;
  const months=["january","february","march","april","may","june","july","august","september","october","november","december"];
  const [year,month,day]=date.split("-").map(Number);
  const m=months[month-1],d=`0?${day}(?:st|nd|rd|th)?`;
  return new RegExp(`\\b(?:${d}\\s+(?:${m}|${m.slice(0,3)})\\.?\\s*,?\\s*${year}|(?:${m}|${m.slice(0,3)})\\.?\\s+${d}\\s*,?\\s*${year})\\b`,"i").test(quote);
}
const iso = (d: Date | string | null) => d ? new Date(d).toISOString() : null;
export async function getProject(id: string, visibility: { public?: boolean; organizationId?: string } = {}) {
  const result = await pool.query(`SELECT p.*, o.name AS organization_name FROM projects p JOIN organizations o ON p.organization_id=o.id
    WHERE p.id=$1 AND ($2::boolean=false OR p.status='published') AND ($3::uuid IS NULL OR p.organization_id=$3)`,
    [id, !!visibility.public, visibility.organizationId ?? null]);
  const p = result.rows[0];
  if (!p) throw new HttpError(404, "Project not found.");
  const [claims, statistics, updates, media] = await Promise.all([
    pool.query(`SELECT c.id,c.text,c.source_url AS "sourceUrl",c.quote,
      COALESCE((SELECT json_agg(json_build_object('id',r.id,'findings',r.findings,'limitations',r.limitations,'evidenceUrls',r.evidence_urls,'createdAt',r.created_at) ORDER BY r.created_at)
      FROM independent_reviews r WHERE r.claim_id=c.id),'[]'::json) AS reviews FROM evidence_claims c WHERE c.project_id=$1`, [id]),
    pool.query(`SELECT id,label,value,unit,claim_id AS "claimId",source_url AS "sourceUrl",quote,to_char(as_of,'YYYY-MM-DD') AS "asOf" FROM impact_statistics WHERE project_id=$1`, [id]),
    pool.query(`SELECT id,title,to_char(date,'YYYY-MM-DD') AS date,body,source_url AS "sourceUrl",quote FROM project_updates WHERE project_id=$1 ORDER BY date DESC`, [id]),
    pool.query(`SELECT id,url,type,caption,permission_status AS "permissionStatus",source_url AS "sourceUrl" FROM media WHERE project_id=$1 AND ($2::boolean=false OR permission_status='approved')`, [id, !!visibility.public]),
  ]);
  return GetPublicProjectResponse.parse({
    id: p.id, organizationId: p.organization_id, organizationName: p.organization_name,
    title: p.title, overview: p.overview, cause: p.cause, locationName: p.location_name,
    latitude: p.latitude, longitude: p.longitude, sourceUrl: p.source_url, status: p.status,
    warnings: p.warnings, isSample: p.is_sample, demonstration: p.demonstration ?? null, approvedAt: iso(p.approved_at), publishedAt: iso(p.published_at),
    createdAt: iso(p.created_at), updatedAt: iso(p.updated_at),
    statistics: withPublicationDates("statistics", statistics.rows, p.evidence_publications ?? {}),
    updates: withPublicationDates("updates", updates.rows, p.evidence_publications ?? {}),
    media: withPublicationDates("media", media.rows, p.evidence_publications ?? {}),
    claims: withPublicationDates("claims", claims.rows.map(c => ({...c, label: c.reviews.length ? "Independently Reviewed" : "Organization Reported"})), p.evidence_publications ?? {}),
    immersion: visibility.public
      ? publicImmersion(p.immersion ?? emptyImmersion(), new Set(media.rows.map(m => m.id)), new Set(claims.rows.map(c => c.id)))
      : p.immersion ?? emptyImmersion(),
  });
}
export async function audit(client: PoolClient, actor: string, action: string, id: string) {
  await client.query("INSERT INTO audit_events(actor_id,action,resource_id) VALUES($1,$2,$3)", [actor, action, id]);
}
export function validateEvidence(revision: Revision, sourceText: string, sourceUrl: string, sources:Record<string,string> = {}) {
  const text = normalize(sourceText);
  requireCondition(revision.title.trim().length > 0 && text.includes(normalize(revision.title)), 422, "Project title must use wording from the fetched source.");
  requireCondition(revision.overview.trim().length > 0 && text.includes(normalize(revision.overview)), 422, "Overview must be an excerpt from the fetched source.");
  const allowedSource = safeUrl(sourceUrl).toString();
  const check = (entry: { sourceUrl: string; quote: string }) => {
    const url=safeUrl(entry.sourceUrl).toString();
    const source=url===allowedSource ? sourceText : sources[url];
    requireCondition(typeof source==="string", 422, "Evidence must link to an included, fetched source.");
    requireCondition(entry.quote.trim().length >= 12 && normalize(source).includes(normalize(entry.quote)), 422, "Evidence quote is missing from the fetched source. Unsupported material cannot be saved.");
  };
  const ids = new Set<string>();
  for (const c of revision.claims) {
    check(c);
    requireCondition(!ids.has(c.id), 422, "Duplicate claim identifiers.");
    ids.add(c.id);
    // Claims are extractive, not AI paraphrases: exact sourced wording is the claim.
    requireCondition(normalize(c.text) === normalize(c.quote), 422, "A claim must use the exact source quotation, not an unsupported paraphrase.");
  }
  for (const s of revision.statistics) {
    check(s);
    requireCondition(ids.has(s.claimId), 422, "Each statistic must reference an included claim.");
    requireCondition(s.value.trim().length > 0 && normalize(s.quote).includes(normalize(s.value)), 422, "Statistic value does not appear in its source quotation.");
    requireCondition(s.label.trim().length > 0 && normalize(s.quote).includes(normalize(s.label)), 422, "Statistic label must use wording from its source quote.");
    requireCondition(!s.unit || normalize(s.quote).includes(normalize(s.unit)), 422, "Statistic unit is not supported by its source quotation.");
    const claim = revision.claims.find(c => c.id === s.claimId)!;
    requireCondition(s.sourceUrl===claim.sourceUrl,422,"Statistic and evidence claim must identify the same source.");
    requireCondition(normalize(claim.quote) === normalize(s.quote), 422, "Statistic and evidence claim must share the same quotation.");
    if (s.asOf) requireCondition(hasDocumentedDate(s.quote,s.asOf), 422, "Statistic date must occur in its source quote.");
  }
  for (const u of revision.updates) {
    check(u);
    requireCondition(/^\d{4}-\d{2}-\d{2}$/.test(u.date) && Number.isFinite(Date.parse(u.date)), 422, "Timeline updates require valid dates.");
    requireCondition(hasDocumentedDate(u.quote,u.date), 422, "Timeline date must occur in its source quote.");
    requireCondition(normalize(u.body) === normalize(u.quote), 422, "Timeline text must retain the exact source quotation.");
  }
  for (const m of revision.media) {
    safeUrl(m.url); safeUrl(m.sourceUrl);
    requireCondition(safeUrl(m.sourceUrl).toString()===allowedSource || Object.hasOwn(sources,safeUrl(m.sourceUrl).toString()),422,"Media must retain an included source.");
    requireCondition(!/\.(svg|html?|js)(\?|$)/i.test(m.url), 422, "Active media formats are not allowed.");
  }
}
export async function saveRevision(id: string, organizationId: string, revision: Revision, actor: string, jobId?: string, generated?:{sourceUrl:string;corpus:string;hash:string;warnings:string[];sources:Record<string,string>}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {rows} = await client.query("SELECT * FROM projects WHERE id=$1 AND organization_id=$2 FOR UPDATE", [id, organizationId]);
    const p = rows[0];
    requireCondition(p, 404, "Project not found.");
    if (!jobId) {
      const active = await client.query("SELECT id FROM generation_jobs WHERE project_id=$1 AND status IN ('queued','fetching','generating','building','preparing')", [id]);
      requireCondition(!active.rowCount, 409, "Wait for generation to finish before editing.");
    }
    if(generated){
      requireCondition(!!jobId,409,"Generated evidence needs an active job.");
      await client.query("UPDATE projects SET source_url=$2,source_text=$3,source_hash=$4,warnings=$5,source_evidence=$6 WHERE id=$1",[id,generated.sourceUrl,generated.corpus,generated.hash,JSON.stringify(generated.warnings),JSON.stringify(generated.sources)]);
    }
    validateEvidence(revision, generated?.corpus ?? p.source_text ?? "", generated?.sourceUrl ?? p.source_url, generated?.sources ?? p.source_evidence ?? {});
    // Extraction cannot authorize spatial claims, regardless of the model output.
    if (jobId) revision = { ...revision, immersion: emptyImmersion() };
    validateImmersion(revision, {
      ...(generated?.sources ?? p.source_evidence ?? {}),
      [safeUrl(generated?.sourceUrl ?? p.source_url).toString()]: generated?.corpus ?? p.source_text ?? "",
    }, hasDocumentedDate);
    const oldClaims = await client.query("SELECT * FROM evidence_claims WHERE project_id=$1", [id]);
    const oldMedia = await client.query("SELECT * FROM media WHERE project_id=$1", [id]);
    // A confirmed placement must describe saved evidence, not a new URL or changed quotation
    // smuggled into the same request. Save corrections, then confirm the resulting records.
    for (const scene of revision.immersion?.scenes ?? []) {
      const sceneMedia = revision.media.find(m => m.id === scene.mediaId)!;
      const original = oldMedia.rows.find(m => m.id === scene.mediaId);
      requireCondition(original, 422, "Save media before adding an immersive scene.");
      const confirmed = scene.panoramaConfirmed || scene.hotspots.some(h => h.confirmed) ||
        revision.immersion?.comparisons.some(c => c.confirmed && [c.beforeMediaId,c.afterMediaId].includes(scene.mediaId));
      if (confirmed) requireCondition(original.url === sceneMedia.url && original.type === sceneMedia.type &&
        original.source_url === sceneMedia.sourceUrl && original.caption === sceneMedia.caption,
        422, "Save media corrections before confirming its immersive evidence.");
      for (const h of scene.hotspots.filter(h => h.confirmed)) {
        if (h.kind === "claim") {
          const c = revision.claims.find(c => c.id === h.recordId)!;
          requireCondition(oldClaims.rows.some(o => o.id === c.id && o.text === c.text && o.quote === c.quote && o.source_url === c.sourceUrl),
            422, "Save claim corrections before confirming a hotspot.");
        } else {
          const m = revision.media.find(m => m.id === h.recordId)!;
          requireCondition(oldMedia.rows.some(o => o.id === m.id && o.url === m.url && o.type === m.type && o.source_url === m.sourceUrl && o.caption === m.caption),
            422, "Save media corrections before confirming a hotspot.");
        }
      }
    }
    const claimMap = new Map<string, string>();
    const kept: string[] = [];
    for (const c of revision.claims) {
      const old = oldClaims.rows.find(o => o.id === c.id && o.text === c.text && o.quote === c.quote && o.source_url === c.sourceUrl);
      const newId = old?.id ?? randomUUID();
      if (!old) await client.query("INSERT INTO evidence_claims(id,project_id,text,source_url,quote) VALUES($1,$2,$3,$4,$5)", [newId,id,c.text,c.sourceUrl,c.quote]);
      claimMap.set(c.id, newId); kept.push(newId);
    }
    await client.query("DELETE FROM impact_statistics WHERE project_id=$1", [id]);
    await client.query("DELETE FROM evidence_claims WHERE project_id=$1 AND NOT (id=ANY($2::uuid[]))", [id,kept]);
    for (const s of revision.statistics) await client.query(`INSERT INTO impact_statistics(project_id,claim_id,label,value,unit,source_url,quote,as_of) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id,claimMap.get(s.claimId),s.label,s.value,s.unit,s.sourceUrl,s.quote,s.asOf]);
    await client.query("DELETE FROM project_updates WHERE project_id=$1", [id]);
    for (const u of revision.updates) await client.query("INSERT INTO project_updates(project_id,title,date,body,source_url,quote) VALUES($1,$2,$3,$4,$5,$6)", [id,u.title,u.date,u.body,u.sourceUrl,u.quote]);
    await client.query("DELETE FROM media WHERE project_id=$1", [id]);
    const mediaMap = new Map<string, string>();
    for (const m of revision.media) {
      const saved = await client.query("INSERT INTO media(project_id,url,type,caption,permission_status,source_url) VALUES($1,$2,$3,$4,$5,$6) RETURNING id", [id,m.url,m.type,m.caption,m.permissionStatus,m.sourceUrl]);
      mediaMap.set(m.id, saved.rows[0].id);
    }
    await client.query("UPDATE projects SET immersion=$2 WHERE id=$1", [
      id, JSON.stringify(remapImmersion(revision.immersion ?? emptyImmersion(), mediaMap, claimMap)),
    ]);
    await client.query(`UPDATE projects SET title=$2,overview=$3,cause=$4,location_name=$5,latitude=$6,longitude=$7,status='draft',approved_at=NULL,published_at=NULL,updated_at=now() WHERE id=$1`,
      [id,revision.title,revision.overview,revision.cause,revision.locationName,
        revision.latitude === null ? null : Math.round(revision.latitude), revision.longitude === null ? null : Math.round(revision.longitude)]);
    if (jobId) await client.query("UPDATE generation_jobs SET status='completed',message='Draft generated. Review sources and permissions before publishing.',updated_at=now() WHERE id=$1", [jobId]);
    await audit(client, actor, jobId ? "generation.completed" : "project.revised", id);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  return getProject(id, {organizationId});
}
export function publicationErrors(project: Awaited<ReturnType<typeof getProject>>) {
  const errors: string[] = [];
  if (!project.title.trim() || !project.overview.trim() || !project.cause.trim()) errors.push("Title, overview and cause are required.");
  if (!project.locationName.trim() || project.latitude === null || project.longitude === null) errors.push("An approximate public location is required for the donor map.");
  if (!project.claims.length) errors.push("At least one source-backed claim is required.");
  if (project.media.some(m => m.permissionStatus === "pending")) errors.push("Confirm permissions or remove all pending media.");
  return errors;
}
