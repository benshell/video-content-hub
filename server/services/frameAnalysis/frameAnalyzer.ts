import { OpenAI } from "openai";
import { db } from "../../../db";
import { keyframes, tags } from "@db/schema";
import sharp from "sharp";
import { ObjectDetectionAgent } from "./agents/objectDetectionAgent";
import { SceneClassificationAgent } from "./agents/sceneClassificationAgent";
import { EventDetectionAgent } from "./agents/eventDetectionAgent";
import { NarrativeAgent } from "./agents/narrativeAgent";
import { FrameAnalysis } from "./types";

export class FrameAnalyzer {
  private openai: OpenAI;
  private objectDetectionAgent: ObjectDetectionAgent;
  private sceneClassificationAgent: SceneClassificationAgent;
  private eventDetectionAgent: EventDetectionAgent;
  private narrativeAgent: NarrativeAgent;

  constructor(openai: OpenAI) {
    this.openai = openai;
    this.objectDetectionAgent = new ObjectDetectionAgent(openai);
    this.sceneClassificationAgent = new SceneClassificationAgent(openai);
    this.eventDetectionAgent = new EventDetectionAgent(openai);
    this.narrativeAgent = new NarrativeAgent(openai);
  }

  async analyzeFrame(frameBuffer: Buffer, frameNumber: number, timestamp: number, videoId: number): Promise<FrameAnalysis> {
    try {
      // Compress and convert frame to base64
      const resizedBuffer = await sharp(frameBuffer)
        .resize(800, null, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      const base64Image = resizedBuffer.toString('base64');

      // Step 1: Object Detection
      const objectDetection = await this.objectDetectionAgent.analyze(
        base64Image,
        frameNumber,
        timestamp
      );

      // Step 2: Scene Classification
      const sceneClassification = await this.sceneClassificationAgent.analyze(
        base64Image,
        frameNumber,
        timestamp,
        objectDetection
      );

      // Step 3: Event Detection
      await this.eventDetectionAgent.addFrame(
        frameNumber,
        timestamp,
        objectDetection,
        sceneClassification
      );
      const events = await this.eventDetectionAgent.detectEvents();

      // Step 4: Narrative Generation
      const narrative = await this.narrativeAgent.analyze(
        base64Image,
        frameNumber,
        timestamp,
        objectDetection,
        sceneClassification,
        events
      );

      // Combine all analyses
      const analysis: FrameAnalysis = {
        frameNumber,
        timestamp,
        objectDetection,
        sceneClassification,
        events,
        narrative,
      };

      // Save to database
      await this.saveAnalysis(analysis, videoId);

      return analysis;
    } catch (error) {
      console.error(`Error analyzing frame ${frameNumber}:`, error);
      throw error;
    }
  }

  private async saveAnalysis(analysis: FrameAnalysis, videoId: number) {
    try {
      // Save keyframe
      const [keyframe] = await db.insert(keyframes).values({
        videoId,
        timestamp: analysis.timestamp,
        metadata: {
          semanticDescription: {
            summary: analysis.narrative.summary,
            keyElements: analysis.narrative.keyElements,
            mood: analysis.sceneClassification.attributes.mood,
            composition: analysis.sceneClassification.attributes.composition,
          },
          objects: {
            people: analysis.objectDetection.objects
              .filter(obj => obj.class.toLowerCase().includes('person'))
              .map(obj => obj.class),
            items: analysis.objectDetection.objects
              .filter(obj => !obj.class.toLowerCase().includes('person'))
              .map(obj => obj.class),
            environment: [analysis.sceneClassification.scene],
          },
          actions: {
            primary: analysis.narrative.actions.primary,
            secondary: analysis.narrative.actions.secondary,
            movements: analysis.events.map(event => event.description),
          },
          technical: {
            lighting: analysis.sceneClassification.attributes.lighting,
            cameraAngle: "auto-detected",
            visualQuality: "high",
          },
        },
      }).returning();

      // Create tags from objects and events
      const tagPromises = [
        ...analysis.objectDetection.objects.map(obj =>
          db.insert(tags).values({
            videoId,
            name: obj.class,
            category: 'object',
            timestamp: analysis.timestamp,
            confidence: Math.round(obj.confidence * 100),
            aiGenerated: 1,
          })
        ),
        ...analysis.events.map(event =>
          db.insert(tags).values({
            videoId,
            name: event.eventType,
            category: 'event',
            timestamp: event.startTime,
            confidence: Math.round(event.confidence * 100),
            aiGenerated: 1,
          })
        ),
      ];

      await Promise.all(tagPromises);

    } catch (error) {
      console.error("Error saving frame analysis:", error);
      throw error;
    }
  }

  async analyzeBatch(frames: Array<{ buffer: Buffer; frameNumber: number; timestamp: number }>, videoId: number) {
    const results = [];
    const batchSize = 5; // Process 5 frames at a time

    for (let i = 0; i < frames.length; i += batchSize) {
      const batch = frames.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(frame => 
          this.analyzeFrame(frame.buffer, frame.frameNumber, frame.timestamp, videoId)
        )
      );
      results.push(...batchResults);
    }

    return results;
  }
}
