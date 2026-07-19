import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const scenesTable = pgTable("scenes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  sceneNumber: integer("scene_number").notNull(),
  heading: text("heading").notNull(),
  intExt: text("int_ext").notNull().default("INT"),
  dayNight: text("day_night").notNull().default("DAY"),
  location: text("location").notNull().default(""),
  durationPages: real("duration_pages"),
  summary: text("summary").notNull().default(""),
  characters: text("characters").array().notNull().default([]),
  props: text("props").array().notNull().default([]),
  costumes: text("costumes").array().notNull().default([]),
  notes: text("notes"),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  corrected: boolean("corrected").notNull().default(false),
  shootDayId: integer("shoot_day_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSceneSchema = createInsertSchema(scenesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScene = z.infer<typeof insertSceneSchema>;
export type Scene = typeof scenesTable.$inferSelect;
