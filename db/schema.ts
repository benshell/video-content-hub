import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const videos = pgTable("videos", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const videosRelations = relations(videos, ({ many }) => ({
  tags: many(tags),
  keyframes: many(keyframes),
}));

export const tags = pgTable("tags", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  videoId: integer("video_id").notNull().references(() => videos.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  timestamp: integer("timestamp").notNull(),
  confidence: integer("confidence"),
  aiGenerated: integer("ai_generated").default(0),
});

export const tagsRelations = relations(tags, ({ one }) => ({
  video: one(videos, {
    fields: [tags.videoId],
    references: [videos.id],
  }),
}));

export const keyframes = pgTable("keyframes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  videoId: integer("video_id").notNull().references(() => videos.id),
  timestamp: integer("timestamp").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  metadata: jsonb("metadata")
});

export const keyframesRelations = relations(keyframes, ({ one }) => ({
  video: one(videos, {
    fields: [keyframes.videoId],
    references: [videos.id],
  }),
}));

export const insertVideoSchema = createInsertSchema(videos);
export const selectVideoSchema = createSelectSchema(videos);
export const insertTagSchema = createInsertSchema(tags);
export const selectTagSchema = createSelectSchema(tags);
export const insertKeyframeSchema = createInsertSchema(keyframes);
export const selectKeyframeSchema = createSelectSchema(keyframes);

export type Video = z.infer<typeof selectVideoSchema>;
export type Tag = z.infer<typeof selectTagSchema>;
export type Keyframe = z.infer<typeof selectKeyframeSchema>;
