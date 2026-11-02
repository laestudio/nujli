import { pool } from "@workspace/db";
import { randomBytes } from "node:crypto";
import { getWhopClient } from "./whopClient";
import { HttpError, requireCondition } from "./errors";
import { developerEntitlement } from "./developer-access";

const productUrl = "https://whop.com/nujli-2/nujli-annual-impact-revealed/";
export async function livePlan() {
  requireCondition(process.env.WHOP_COMPANY_ID && process.env.WHOP_PRODUCT_ID, 503, "Whop product configuration is missing.");
  const result = await getWhopClient().request(`/plans?company_id=${process.env.WHOP_COMPANY_ID}&product_ids[]=${process.env.WHOP_PRODUCT_ID}&first=100`);
  const plans = result.data?.filter((p: any) => p.product?.id === process.env.WHOP_PRODUCT_ID && p.visibility !== "hidden") ?? [];
  requireCondition(plans.length === 1, 503, "A single purchasable Whop plan could not be confirmed.");
  return plans[0];
}
export async function billingPackage() {
  try {
    const plan = await livePlan();
    requireCondition(Number.isFinite(Number(plan.renewal_price ?? plan.initial_price)) && typeof plan.currency==="string",503,"Whop returned incomplete pricing. Checkout terms cannot be confirmed.");
    return {status:"ready", name:"nujli. Annual", message:process.env.WHOP_WEBHOOK_SECRET ? "Terms retrieved from Whop." : "Webhook signing secret is missing. Purchases are temporarily disabled.",
      price:Number(plan.renewal_price ?? plan.initial_price), currency:plan.currency, billingPeriodDays:plan.billing_period ?? null,
      trialDays:plan.trial_period_days ?? 0, checkoutReady:!!process.env.WHOP_WEBHOOK_SECRET, productUrl};
  } catch(e) {
    return {status:"blocked", name:"nujli. Annual", message:(e instanceof HttpError ? e.message : "Whop pricing is unavailable.")+(!process.env.WHOP_WEBHOOK_SECRET?" WHOP_WEBHOOK_SECRET is also missing.":""), checkoutReady:false, productUrl};
  }
}
export function membershipState(m: any) {
  const end = m.renewal_period_end ?? m.current_period_end ?? m.expires_at;
  const validEnd = typeof end === "string" && Number.isFinite(Date.parse(end)) && Date.parse(end) > Date.now();
  const active = m.valid !== false && ["active","trialing"].includes(m.status) && validEnd && !m.cancel_at_period_end;
  return {active, status:active ? m.status : "inactive", expiresAt:end ?? null,
    message:active ? "Membership verified with Whop." : "Membership is canceled, expired, unpaid, or could not be confirmed. Paid features are locked."};
}
export async function entitlement(organizationId?: string) {
  if (!organizationId) return {active:false,status:"unpaid",message:"Create an organization and purchase a verified membership.",expiresAt:null};
  if (await developerEntitlement(organizationId)) return {active:true,status:"developer",message:"Developer access for this development instance. No payment or Whop membership has been verified.",expiresAt:null};
  if (!process.env.WHOP_WEBHOOK_SECRET) return {active:false,status:"blocked",message:"Payment verification is not configured. Paid features are locked.",expiresAt:null};
  const {rows} = await pool.query("SELECT * FROM memberships WHERE organization_id=$1 ORDER BY checked_at DESC LIMIT 1", [organizationId]);
  if (!rows[0]) return {active:false,status:"unpaid",message:"No verified membership. Opening checkout does not grant access.",expiresAt:null};
  if(rows[0].status==="payment_failed") return {active:false,status:"unpaid",message:"Whop reported a failed payment. Access stays locked until a verified successful payment event is received.",expiresAt:rows[0].expires_at?.toISOString()??null};
  try {
    const m = await getWhopClient().request(`/memberships/${encodeURIComponent(rows[0].id)}`);
    requireCondition(m.product?.id === process.env.WHOP_PRODUCT_ID && (m.user?.id ?? m.user_id) === rows[0].whop_user_id, 403, "Membership does not match.");
    const state = membershipState(m);
    await pool.query("UPDATE memberships SET valid=$2,status=$3,expires_at=$4,checked_at=now() WHERE id=$1", [m.id,state.active,m.status,state.expiresAt]);
    return state;
  } catch { return {active:false,status:"blocked",message:"Whop could not verify your membership. Access is locked until verification succeeds.",expiresAt:null}; }
}
export async function requirePaid(orgId: string) {
  const access = await entitlement(orgId);
  if (!access.active) throw new HttpError(access.status === "blocked" ? 503 : 402, access.message);
}
export async function checkout(orgId: string, origin: string) {
  requireCondition(process.env.WHOP_WEBHOOK_SECRET, 503, "Verified payment webhooks are not configured. Checkout is disabled.");
  const access=await entitlement(orgId);
  requireCondition(!access.active,409,"Your membership is already active. Continue to Generate instead of purchasing again.");
  const plan = await livePlan();
  const client=await pool.connect();
  try{
  await client.query("BEGIN");
  await client.query("SELECT id FROM organizations WHERE id=$1 FOR UPDATE",[orgId]);
  const prior=await client.query("SELECT checkout_url FROM orders WHERE organization_id=$1 AND status='pending' AND checkout_url IS NOT NULL AND created_at>now()-interval '30 minutes' ORDER BY created_at DESC LIMIT 1",[orgId]);
  if(prior.rows[0]){await client.query("COMMIT");return {url:prior.rows[0].checkout_url};}
  const token = randomBytes(32).toString("hex");
  const {rows} = await client.query("INSERT INTO orders(organization_id,binding_token) VALUES($1,$2) RETURNING id", [orgId, token]);
  const result = await getWhopClient().request("/checkout_configurations", "POST", {
    plan_id:plan.id, redirect_url:`${origin}/billing`, metadata:{nujli_binding:token},
  });
  requireCondition(result.id && isWhopCheckoutUrl(result.purchase_url), 503, "Whop did not return a valid checkout.");
  await client.query("UPDATE orders SET checkout_id=$2,checkout_url=$3 WHERE id=$1", [rows[0].id,result.id,result.purchase_url]);
  await client.query("COMMIT");
  return {url:result.purchase_url};
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
export function isWhopCheckoutUrl(value:unknown){
  try{const url=new URL(String(value));return url.protocol==="https:"&&!url.username&&!url.password&&(url.hostname==="whop.com"||url.hostname.endsWith(".whop.com"));}catch{return false;}
}
