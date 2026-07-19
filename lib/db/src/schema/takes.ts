import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const takesTable = pgTable("takes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  sceneId: integer("scene_id"),
  shootDayId: integer("shoot_day_id"),
  sceneNumber: integer("scene_number").notNull(),
  shotLabel: text("shot_label").notNull(),
  takeNumber: integer("take_number").notNull(),
  circled: boolean("circled").notNull().default(false),
  notes: text("notes"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTakeSchema = createInsertSchema(takesTable).omit({ id: true, createdAt: true });
export type InsertTake = z.infer<typeof insertTakeSchema>;
export type Take = typeof takesTable.$inferSelect;
