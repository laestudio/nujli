import { clerkClient } from "@clerk/express";
import { pool } from "@workspace/db";

// Metadata grants apply only in development. Production additionally supports
// the explicitly configured owner with a provider-verified primary email.
// Never infer access from a request, email domain, or first registration.
export function developmentInstance() {
  return process.env.NODE_ENV === "development" &&
    (process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_test_");
}
export function eligibleDeveloper(metadata: Record<string, unknown>) {
  return developmentInstance() && metadata.developerAccess === true && metadata.role !== "reviewer";
}
type DemoUser = {
  publicMetadata: Record<string, unknown>;
  primaryEmailAddressId: string | null;
  emailAddresses: {id:string;emailAddress:string;verification:{status:string}|null}[];
};
export function eligibleDemoUser(user: DemoUser) {
  if (user.publicMetadata.role === "reviewer") return false;
  if (eligibleDeveloper(user.publicMetadata)) return true;
  const owner = process.env.NUJLI_DEMO_OWNER_EMAIL?.trim().toLowerCase();
  if (process.env.NODE_ENV !== "production" || !owner) return false;
  return user.emailAddresses.some(email => email.id === user.primaryEmailAddressId &&
    email.verification?.status === "verified" && email.emailAddress.toLowerCase() === owner);
}
export async function developerEntitlement(organizationId: string) {
  const row = (await pool.query("SELECT owner_id FROM organizations WHERE id=$1", [organizationId])).rows[0];
  if (!row) return false;
  const user = await clerkClient.users.getUser(row.owner_id);
  return eligibleDemoUser(user) && user.publicMetadata.developerAccessEnabled === true;
}
