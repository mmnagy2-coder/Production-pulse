import { pgTable, text, serial, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productionStageEnum = ["development", "pre_production", "production", "post_production", "delivery"] as const;

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  logline: text("logline"),
  genre: text("genre"),
  currentStage: text("current_stage").notNull().default("development"),
  scriptText: text("script_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  // Every route scopes reads by user_id; tenancy is enforced in app code rather
  // than by RLS, so this index is on the hot path for all project queries.
  index("projects_user_id_idx").on(table.userId),
]);

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
