import { pgTable, text, timestamp, uuid, date, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const evidenceClaims = pgTable("evidence_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  sourceUrl: text("source_url").notNull(),
  quote: text("quote").notNull(),
});
export const impactStatistics = pgTable("impact_statistics", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  claimId: uuid("claim_id").notNull().references(() => evidenceClaims.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  value: text("value").notNull(),
  unit: text("unit").notNull(),
  sourceUrl: text("source_url").notNull(),
  quote: text("quote").notNull(),
  asOf: date("as_of", { mode: "string" }),
});
export const projectUpdates = pgTable("project_updates", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  body: text("body").notNull(),
  sourceUrl: text("source_url").notNull(),
  quote: text("quote").notNull(),
});
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  type: text("type").notNull(),
  caption: text("caption").notNull(),
  permissionStatus: text("permission_status").notNull().default("pending"),
  sourceUrl: text("source_url").notNull(),
});
export const independentReviews = pgTable("independent_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  claimId: uuid("claim_id").notNull().references(() => evidenceClaims.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id").notNull(),
  findings: text("findings").notNull(),
  limitations: text("limitations").notNull(),
  evidenceUrls: jsonb("evidence_urls").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("reviewer_claim_once").on(t.claimId, t.reviewerId)]);
