import { pool } from "@workspace/db";
import type { PoolClient } from "pg";
import snapshot from "../data/palestine-public-demonstration.json";

const actor = "nujli-system-public-data-demonstrations";
const action = "demonstration.production-import";
const projectId = snapshot.projects[0].id;
const tables = ["organizations", "projects", "evidence_claims", "impact_statistics", "project_updates", "media"] as const;

// Data only: no schema changes, customer accounts, memberships, or AI calls.
// Caller owns the transaction. The audit marker prevents resurrection after removal.
export async function importPublicDemonstration(client: PoolClient) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [action]);
  const done = await client.query("SELECT 1 FROM audit_events WHERE actor_id=$1 AND action=$2 AND resource_id=$3", [actor, action, projectId]);
  if (done.rowCount) return "already-imported";
  if (snapshot.organizations[0].owner_id !== actor || snapshot.projects[0].status !== "published" ||
    !snapshot.projects[0].demonstration || snapshot.projects[0].approved_at !== null) {
    throw new Error("Public demonstration snapshot failed safety validation.");
  }
  const existing = await client.query("SELECT id FROM projects WHERE id=$1", [projectId]);
  if (!existing.rowCount) {
    const organization = await client.query("SELECT id FROM organizations WHERE owner_id=$1", [actor]);
    const orgId = organization.rows[0]?.id ?? snapshot.organizations[0].id;
    for (const table of tables) {
      if (table === "organizations" && organization.rowCount) continue;
      for (const original of snapshot[table]) {
        const row: Record<string, unknown> = { ...original };
        if (table === "projects") row.organization_id = orgId;
        const columns = Object.keys(row);
        if (columns.some(column => !/^[a-z_]+$/.test(column))) throw new Error("Invalid snapshot column.");
        const values = columns.map(column => {
          const value = row[column];
          return value !== null && typeof value === "object" ? JSON.stringify(value) : value;
        });
        await client.query(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")})`, values);
      }
    }
  }
  await client.query("INSERT INTO audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$3,$4)", [
    actor, action, projectId, JSON.stringify({ source: "existing-public-demonstration", organizationApproval: false, existingRecordPreserved: !!existing.rowCount }),
  ]);
  return existing.rowCount ? "existing-record-preserved" : "imported";
}

export async function bootstrapPublicDemonstration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const result = await importPublicDemonstration(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
