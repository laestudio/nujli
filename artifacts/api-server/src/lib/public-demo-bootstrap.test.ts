import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "@workspace/db";
import { importPublicDemonstration } from "./public-demo-bootstrap";

test("public demo import is complete, repeatable, and respects later removal", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Isolated temporary copies: never delete or modify actual project records.
    for (const table of ["organizations", "projects", "evidence_claims", "impact_statistics", "project_updates", "media", "audit_events"]) {
      await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    }
    assert.equal(await importPublicDemonstration(client), "imported");
    const project = (await client.query("SELECT * FROM projects")).rows[0];
    assert.equal(project.status, "published");
    assert.equal(project.approved_at, null);
    assert.equal(project.latitude, 32);
    assert.equal(project.longitude, 35);
    for (const [table, expected] of [["impact_statistics", 4], ["project_updates", 4], ["evidence_claims", 4], ["media", 1]] as const) {
      assert.equal((await client.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, expected);
    }
    assert.equal(await importPublicDemonstration(client), "already-imported");
    assert.equal((await client.query("SELECT count(*)::int AS n FROM projects")).rows[0].n, 1);
    await client.query("DELETE FROM projects");
    assert.equal(await importPublicDemonstration(client), "already-imported");
    assert.equal((await client.query("SELECT count(*)::int AS n FROM projects")).rows[0].n, 0);
    await client.query("ROLLBACK");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
