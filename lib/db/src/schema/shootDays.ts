import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const shootDaysTable = pgTable("shoot_days", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
  label: text("label").notNull(),
  date: date("date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertShootDaySchema = createInsertSchema(shootDaysTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShootDay = z.infer<typeof insertShootDaySchema>;
export type ShootDay = typeof shootDaysTable.$inferSelect;
