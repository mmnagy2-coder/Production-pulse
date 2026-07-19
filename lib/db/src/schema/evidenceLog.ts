import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const evidenceLogTable = pgTable("evidence_log", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  actionType: text("action_type").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  summary: text("summary").notNull(),
  metadataJson: text("metadata_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEvidenceLogSchema = createInsertSchema(evidenceLogTable).omit({ id: true, createdAt: true });
export type InsertEvidenceLog = z.infer<typeof insertEvidenceLogSchema>;
export type EvidenceLog = typeof evidenceLogTable.$inferSelect;
