import { clerkClient } from "@clerk/express";
import { pool } from "@workspace/db";

// A development-only, owner-granted privilege. Never inferred from a request,
// email domain, organization name, or the first person to register.
export function developmentInstance() {
  return process.env.NODE_ENV === "development" &&
    (process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "").startsWith("pk_test_");
}
export function eligibleDeveloper(metadata: Record<string, unknown>) {
  return developmentInstance() && metadata.developerAccess === true && metadata.role !== "reviewer";
}
export async function developerEntitlement(organizationId: string) {
  if (!developmentInstance()) return false;
  const row = (await pool.query("SELECT owner_id FROM organizations WHERE id=$1", [organizationId])).rows[0];
  if (!row) return false;
  const user = await clerkClient.users.getUser(row.owner_id);
  return eligibleDeveloper(user.publicMetadata) && user.publicMetadata.developerAccessEnabled === true;
}
