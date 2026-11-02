import { pgTable, text, timestamp, uuid, boolean, jsonb, doublePrecision, index } from "drizzle-orm/pg-core";
import { organizations } from "./accounts";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  sourceUrl: text("source_url").notNull(),
  extraSourceUrls: jsonb("extra_source_urls").notNull().default([]),
  sourceEvidence: jsonb("source_evidence").notNull().default({}),
  immersion: jsonb("immersion").notNull().default({ scenes: [], comparisons: [] }),
  evidencePublications: jsonb("evidence_publications").notNull().default({}),
  submissionPermissionAt: timestamp("submission_permission_at", { withTimezone: true }),
  title: text("title").notNull().default("Untitled project"),
  overview: text("overview").notNull().default(""),
  cause: text("cause").notNull().default(""),
  locationName: text("location_name").notNull().default(""),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  status: text("status").notNull().default("draft"),
  warnings: jsonb("warnings").notNull().default([]),
  isSample: boolean("is_sample").notNull().default(false),
  demonstration: jsonb("demonstration"),
  sourceText: text("source_text"),
  sourceHash: text("source_hash"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("projects_visibility").on(t.status), index("projects_org").on(t.organizationId)]);
export const generationJobs = pgTable("generation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  status: text("status").notNull().default("queued"),
  message: text("message").notNull().default("Queued"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const visualBuildProjects = pgTable("visual_build_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").unique().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  conceptual: boolean("conceptual").notNull().default(true),
  stages: jsonb("stages").notNull(),
  fundingPercent: doublePrecision("funding_percent"),
  documentedProgress: text("documented_progress"),
  sourceUrl: text("source_url"),
});
