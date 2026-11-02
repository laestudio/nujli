import { getAuth, clerkClient } from "@clerk/express";
import type { Request } from "express";
import { pool } from "@workspace/db";
import { HttpError } from "./errors";
import { eligibleDemoUser } from "./developer-access";

export async function identity(req: Request) {
  const userId = getAuth(req).userId;
  if (!userId) throw new HttpError(401, "Sign in to your organization account to continue.");
  // Public metadata is writable only with trusted Clerk server credentials.
  const user = await clerkClient.users.getUser(userId);
  const role = user.publicMetadata.role === "reviewer" ? "reviewer" as const : "organization" as const;
  const result = await pool.query("SELECT * FROM organizations WHERE owner_id=$1", [userId]);
  return { userId, role, organization: result.rows[0] ?? null, developerEligible: eligibleDemoUser(user) };
}
export type Identity = Awaited<ReturnType<typeof identity>>;
export async function organizationIdentity(req: Request) {
  const who = await identity(req);
  if (who.role !== "organization") throw new HttpError(403, "An organization account is required.");
  if (!who.organization) throw new HttpError(409, "Create your organization profile first.");
  return who;
}
