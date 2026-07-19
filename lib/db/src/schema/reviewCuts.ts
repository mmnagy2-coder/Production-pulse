import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const reviewCutsTable = pgTable("review_cuts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const cutCommentsTable = pgTable("cut_comments", {
  id: serial("id").primaryKey(),
  cutId: integer("cut_id").notNull().references(() => reviewCutsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  xPercent: real("x_percent").notNull(),
  yPercent: real("y_percent").notNull(),
  pinNumber: integer("pin_number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReviewCutSchema = createInsertSchema(reviewCutsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReviewCut = z.infer<typeof insertReviewCutSchema>;
export type ReviewCut = typeof reviewCutsTable.$inferSelect;

export const insertCutCommentSchema = createInsertSchema(cutCommentsTable).omit({ id: true, createdAt: true });
export type InsertCutComment = z.infer<typeof insertCutCommentSchema>;
export type CutComment = typeof cutCommentsTable.$inferSelect;
