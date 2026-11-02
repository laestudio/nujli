/**
 * Explicit, owner-run import only. No HTTP endpoint, customer entitlement bypass,
 * automatic startup seed, organization approval, or customer data mutation.
 */
import { pool } from "@workspace/db";
import { createHash, randomUUID } from "node:crypto";
import { extractWithAI } from "../lib/generation";
import { getProject, normalize, publicationErrors, saveRevision } from "../lib/projects";
import { ACTIVITY_ID, IATI_DATASET, IATI_REGISTRY, extractIatiDemo } from "../lib/iati-demo";

async function fetchFixed(url: string) {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.body) throw new Error(`Public source returned HTTP ${response.status}`);
  let text = "", bytes = 0;
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 2_000_000) throw new Error("Source exceeds the 2 MB limit.");
    text += decoder.decode(chunk, { stream: true });
  }
  return text + decoder.decode();
}

async function main() {
  const lock = await pool.connect();
  let jobId: string | undefined;
  try {
    await lock.query("SELECT pg_advisory_lock(hashtext('nujli:irw-public-data-demonstration'))");
    const registry = JSON.parse(await fetchFixed("https://iatiregistry.org/api/3/action/package_show?id=irw-activity"));
    const publisher = JSON.parse(await fetchFixed("https://iatiregistry.org/api/3/action/organization_show?id=irw"));
    if (!registry.success || registry.result.license_id !== "other-at" ||
      !registry.result.resources.some((r: { url: string }) => r.url === IATI_DATASET) ||
      publisher.result.publisher_iati_id !== "GB-CHC-328158") throw new Error("Registry provenance or attribution license changed; review required.");
    const xml = await fetchFixed(IATI_DATASET);
    const extracted = extractIatiDemo(xml);
    const owner = "nujli-system-public-data-demonstrations";
    const org = await pool.query(`INSERT INTO organizations(owner_id,name,website) VALUES($1,$2,$3)
      ON CONFLICT(owner_id) DO UPDATE SET owner_id=EXCLUDED.owner_id RETURNING id`, [owner, "nujli. — independent public-data demonstrations", IATI_REGISTRY]);
    const orgId = org.rows[0].id;
    const existing = await pool.query("SELECT id,status FROM projects WHERE organization_id=$1 AND demonstration->>'activityId'=$2", [orgId, ACTIVITY_ID]);
    if (existing.rows[0]?.status === "published") {
      console.log(JSON.stringify({ status: "already-published", projectId: existing.rows[0].id }));
      return;
    }
    const projectId = existing.rows[0]?.id ?? randomUUID();
    await pool.query(`INSERT INTO projects(id,organization_id,source_url,demonstration) VALUES($1,$2,$3,$4)
      ON CONFLICT(id) DO NOTHING`, [projectId, orgId, IATI_DATASET, JSON.stringify(extracted.demonstration)]);
    jobId = randomUUID();
    // Not queued: the background customer worker must never pick up this explicit import.
    await pool.query(`INSERT INTO generation_jobs(id,project_id,organization_id,status,message)
      VALUES($1,$2,$3,'generating','Checking the selected public IATI activity with the server-side AI model.')`, [jobId, projectId, orgId]);
    const ai = await extractWithAI(extracted.corpus);
    if (normalize(ai.title) !== normalize(extracted.revision.title) || !ai.overview.trim() ||
      !normalize(extracted.revision.overview).includes(normalize(ai.overview))) throw new Error("AI identity/excerpt validation failed; no demonstration published.");
    // XML amounts/dates stay deterministic; the model cannot invent or alter them.
    await pool.query("UPDATE generation_jobs SET status='building',message='Validating IATI statistics and timeline.',updated_at=now() WHERE id=$1", [jobId]);
    await saveRevision(projectId, orgId, extracted.revision, owner, jobId, {
      sourceUrl: IATI_DATASET, corpus: extracted.corpus, hash: createHash("sha256").update(xml).digest("hex"),
      warnings: extracted.warnings, sources: { [IATI_DATASET]: extracted.corpus },
    });
    const project = await getProject(projectId, { organizationId: orgId });
    const errors = publicationErrors(project);
    if (errors.length) throw new Error(errors.join(" "));
    await lock.query("BEGIN");
    // An explicitly labeled publisher demonstration is distinct from customer approval.
    await lock.query("UPDATE projects SET status='published',published_at=now(),approved_at=NULL,updated_at=now() WHERE id=$1 AND organization_id=$2 AND demonstration IS NOT NULL", [projectId, orgId]);
    await lock.query("INSERT INTO audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)", [owner, "demonstration.published", projectId, JSON.stringify({ activityId: ACTIVITY_ID, registryUrl: IATI_REGISTRY, organizationApproval: false, aiIdentityCheck: true })]);
    await lock.query("COMMIT");
    console.log(JSON.stringify({ status: "published", projectId, activityId: ACTIVITY_ID, statistics: project.statistics.length, updates: project.updates.length, media: project.media.length }));
  } catch (e) {
    await lock.query("ROLLBACK");
    if (jobId) await pool.query("UPDATE generation_jobs SET status='failed',message=$2,updated_at=now() WHERE id=$1", [jobId, e instanceof Error ? e.message : "Import failed."]);
    throw e;
  } finally {
    await lock.query("SELECT pg_advisory_unlock(hashtext('nujli:irw-public-data-demonstration'))");
    lock.release();
    await pool.end();
  }
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Import failed"); process.exitCode = 1; });
