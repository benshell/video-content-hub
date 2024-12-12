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
  processingStatus: text("processing_status").default("pending"),
  processedFrames: integer("processed_frames").default(0),
  totalFrames: integer("total_frames").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const frameAnalysis = pgTable("frame_analysis", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  videoId: integer("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  frameNumber: integer("frame_number").notNull(),
  timestamp: integer("timestamp").notNull(),
  objects: jsonb("objects").$type<{
    detectedObjects: Array<{
      class: string;
      confidence: number;
      bbox: { x1: number; y1: number; x2: number; y2: number; }
    }>;
    statistics: {
      totalObjects: number;
      uniqueClasses: number;
      averageConfidence: number;
    };
  }>(),
  sceneTags: jsonb("scene_tags").$type<{
    scene: string;
    attributes: {
      lighting: string;
      composition: string;
      mood: string;
      setting: string;
      cameraAngle: string;
      visualQuality: string;
    };
    confidence: number;
  }>(),
  events: jsonb("events").$type<Array<{
    eventType: string;
    description: string;
    confidence: number;
    involvedObjects: string[];
    startTime: number;
    endTime: number;
  }>>(),
  narrative: jsonb("narrative").$type<{
    summary: string;
    keyElements: string[];
    actions: {
      primary: string;
      secondary: string[];
      movements: string[];
    };
    context: string;
  }>(),
  confidenceMetrics: jsonb("confidence_metrics").$type<{
    objectDetection: number;
    sceneClassification: number;
    eventDetection: number;
    overallConfidence: number;
    processingMetadata: {
      processingTime: number;
      modelVersions: Record<string, string>;
      qualityMetrics: Record<string, number>;
    };
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const videoAnalysisSummary = pgTable("video_analysis_summary", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  videoId: integer("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  totalFramesAnalyzed: integer("total_frames_analyzed").notNull(),
  dominantScenes: jsonb("dominant_scenes").$type<Array<{
    scene: string;
    frequency: number;
    confidence: number;
  }>>(),
  keyEvents: jsonb("key_events").$type<Array<{
    timestamp: number;
    eventType: string;
    description: string;
    significance: number;
  }>>(),
  objectFrequency: jsonb("object_frequency").$type<Record<string, number>>(),
  overallNarrative: text("overall_narrative"),
  technicalSummary: jsonb("technical_summary").$type<{
    averageConfidence: number;
    processingTime: number;
    qualityMetrics: Record<string, number>;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tags = pgTable("tags", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  videoId: integer("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  timestamp: integer("timestamp").notNull(),
  confidence: integer("confidence"),
  aiGenerated: integer("ai_generated").default(0),
});

export const keyframes = pgTable("keyframes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  videoId: integer("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  timestamp: integer("timestamp").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  metadata: jsonb("metadata").$type<{
    semanticDescription: {
      summary: string;
      keyElements: string[];
      mood: string;
      composition: string;
    };
    objects: {
      people: string[];
      items: string[];
      environment: string[];
    };
    actions: {
      primary: string;
      secondary: string[];
      movements: string[];
    };
    technical: {
      lighting: string;
      cameraAngle: string;
      visualQuality: string;
    };
  } | null>()
});

// Relations
export const videosRelations = relations(videos, ({ many }) => ({
  tags: many(tags),
  keyframes: many(keyframes),
  frameAnalyses: many(frameAnalysis),
  analysisSummary: many(videoAnalysisSummary),
}));

export const tagsRelations = relations(tags, ({ one }) => ({
  video: one(videos, {
    fields: [tags.videoId],
    references: [videos.id],
  }),
}));

export const keyframesRelations = relations(keyframes, ({ one }) => ({
  video: one(videos, {
    fields: [keyframes.videoId],
    references: [videos.id],
  }),
}));

export const frameAnalysisRelations = relations(frameAnalysis, ({ one }) => ({
  video: one(videos, {
    fields: [frameAnalysis.videoId],
    references: [videos.id],
  }),
}));

export const videoAnalysisSummaryRelations = relations(videoAnalysisSummary, ({ one }) => ({
  video: one(videos, {
    fields: [videoAnalysisSummary.videoId],
    references: [videos.id],
  }),
}));

// Create schemas for all tables
export const insertVideoSchema = createInsertSchema(videos);
export const selectVideoSchema = createSelectSchema(videos);
export const insertTagSchema = createInsertSchema(tags);
export const selectTagSchema = createSelectSchema(tags);
export const insertKeyframeSchema = createInsertSchema(keyframes);
export const selectKeyframeSchema = createSelectSchema(keyframes);
export const insertFrameAnalysisSchema = createInsertSchema(frameAnalysis);
export const selectFrameAnalysisSchema = createSelectSchema(frameAnalysis);
export const insertVideoAnalysisSummarySchema = createInsertSchema(videoAnalysisSummary);
export const selectVideoAnalysisSummarySchema = createSelectSchema(videoAnalysisSummary);

// Export types
export type Video = z.infer<typeof selectVideoSchema>;
export type Tag = z.infer<typeof selectTagSchema>;
export type Keyframe = z.infer<typeof selectKeyframeSchema>;
export type FrameAnalysis = z.infer<typeof selectFrameAnalysisSchema>;
export type VideoAnalysisSummary = z.infer<typeof selectVideoAnalysisSummarySchema>;
