import { z } from "zod";

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DetectedObject {
  class: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface ObjectDetectionResult {
  frameNumber: number;
  timestamp: number;
  objects: DetectedObject[];
}

export interface SceneClassification {
  frameNumber: number;
  timestamp: number;
  scene: string;
  confidence: number;
  attributes: {
    lighting: string;
    composition: string;
    mood: string;
    setting: string;
  };
}

export interface TemporalEvent {
  startFrame: number;
  endFrame: number;
  startTime: number;
  endTime: number;
  eventType: string;
  confidence: number;
  description: string;
  involvedObjects: string[];
}

export interface NarrativeContext {
  frameNumber: number;
  timestamp: number;
  summary: string;
  keyElements: string[];
  actions: {
    primary: string;
    secondary: string[];
  };
  context: string;
}

export interface FrameAnalysis {
  frameNumber: number;
  timestamp: number;
  objectDetection: ObjectDetectionResult;
  sceneClassification: SceneClassification;
  events: TemporalEvent[];
  narrative: NarrativeContext;
}

// Zod schemas for validation
export const boundingBoxSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});

export const detectedObjectSchema = z.object({
  class: z.string(),
  confidence: z.number(),
  bbox: boundingBoxSchema,
});

export const objectDetectionResultSchema = z.object({
  frameNumber: z.number(),
  timestamp: z.number(),
  objects: z.array(detectedObjectSchema),
});

export const sceneClassificationSchema = z.object({
  frameNumber: z.number(),
  timestamp: z.number(),
  scene: z.string(),
  confidence: z.number(),
  attributes: z.object({
    lighting: z.string(),
    composition: z.string(),
    mood: z.string(),
    setting: z.string(),
  }),
});

export const temporalEventSchema = z.object({
  startFrame: z.number(),
  endFrame: z.number(),
  startTime: z.number(),
  endTime: z.number(),
  eventType: z.string(),
  confidence: z.number(),
  description: z.string(),
  involvedObjects: z.array(z.string()),
});

export const narrativeContextSchema = z.object({
  frameNumber: z.number(),
  timestamp: z.number(),
  summary: z.string(),
  keyElements: z.array(z.string()),
  actions: z.object({
    primary: z.string(),
    secondary: z.array(z.string()),
  }),
  context: z.string(),
});

export const frameAnalysisSchema = z.object({
  frameNumber: z.number(),
  timestamp: z.number(),
  objectDetection: objectDetectionResultSchema,
  sceneClassification: sceneClassificationSchema,
  events: z.array(temporalEventSchema),
  narrative: narrativeContextSchema,
});
