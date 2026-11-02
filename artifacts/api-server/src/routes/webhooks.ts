import { Router } from "express";
import { Webhook } from "standardwebhooks";
import { pool } from "@workspace/db";
import { getWhopClient } from "../lib/whopClient";
import { membershipState } from "../lib/billing";
import { HttpError, requireCondition } from "../lib/errors";
const router = Router();
router.post("/whop", async (req,res) => {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  requireCondition(secret,503,"Webhook verification is not configured.");
  let event: any;
  try { event = new Webhook(secret).verify(req.body.toString("utf8"), {
    "webhook-id":req.get("webhook-id") ?? "", "webhook-timestamp":req.get("webhook-timestamp") ?? "", "webhook-signature":req.get("webhook-signature") ?? "",
  }); } catch { throw new HttpError(400,"Invalid webhook signature."); }
  const eventId = req.get("webhook-id")!;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query("INSERT INTO webhook_events(id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id", [eventId,event.type ?? "unknown"]);
    if (!inserted.rowCount) { await client.query("COMMIT"); res.json({received:true,duplicate:true}); return; }
    const membershipId = event.type?.startsWith("membership.") ? event.data?.id : event.data?.membership?.id;
    if (membershipId) {
      // Re-fetch current state: out-of-order events cannot restore a stale entitlement.
      const m = await getWhopClient().request(`/memberships/${encodeURIComponent(membershipId)}`);
      if (m.product?.id === process.env.WHOP_PRODUCT_ID) {
        const binding = m.metadata?.nujli_binding;
        const {rows} = await client.query("SELECT * FROM orders WHERE binding_token=$1 AND checkout_id IS NOT NULL FOR UPDATE", [typeof binding === "string" ? binding : ""]);
        if (rows[0]) {
          const state = membershipState(m);
          const prior=await client.query("SELECT status FROM memberships WHERE id=$1",[m.id]);
          const failed=event.type==="payment.failed" || (prior.rows[0]?.status==="payment_failed" && event.type!=="payment.succeeded");
          const active = !failed && state.active;
          const userId = m.user?.id ?? m.user_id;
          requireCondition(userId,422,"Membership buyer is not available.");
          await client.query(`INSERT INTO memberships(id,organization_id,whop_user_id,product_id,status,valid,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT(id) DO UPDATE SET status=excluded.status,valid=excluded.valid,expires_at=excluded.expires_at,checked_at=now()
            WHERE memberships.organization_id=excluded.organization_id`,
            [m.id,rows[0].organization_id,userId,process.env.WHOP_PRODUCT_ID,failed?"payment_failed":m.status,active,state.expiresAt]);
          await client.query("UPDATE orders SET membership_id=$2,status=$3 WHERE id=$1", [rows[0].id,m.id,active ? "verified" : "inactive"]);
        }
      }
    }
    await client.query("COMMIT"); res.json({received:true});
  } catch(e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
});
export default router;
