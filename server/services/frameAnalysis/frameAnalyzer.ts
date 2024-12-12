import { OpenAI } from "openai";
import { db } from "../../../db";
import { keyframes, tags } from "@db/schema";
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
      console.log(`Processing frame ${frameNumber} at timestamp ${timestamp}`);
      
      // Basic validation of the buffer
      if (!Buffer.isBuffer(frameBuffer)) {
        throw new Error('Invalid buffer provided');
      }
      
      if (frameBuffer.length === 0) {
        throw new Error('Empty buffer provided');
      }
      
      // Convert buffer directly to base64
      const base64Image = frameBuffer.toString('base64');

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
      // Build metadata from analysis
      const metadata = {
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
          cameraAngle: analysis.sceneClassification.attributes.cameraAngle || "auto-detected",
          visualQuality: analysis.sceneClassification.attributes.visualQuality || "high",
        },
      };

      // Set metadata in analysis
      analysis.metadata = metadata;

      // Save keyframe with unified metadata
      const [keyframe] = await db.insert(keyframes).values({
        videoId,
        timestamp: analysis.timestamp,
        metadata: unifiedMetadata,
      }).returning();

      console.log('Saved keyframe with metadata:', {
        id: keyframe.id,
        timestamp: keyframe.timestamp,
        metadata: unifiedMetadata,
      });

      // Create tags from all sources
      const tagsToCreate = [
        // Object detection tags
        ...analysis.objectDetection.objects.map(obj => ({
          videoId,
          name: obj.class,
          category: obj.class.toLowerCase().includes('person') ? 'person' : 'object',
          timestamp: analysis.timestamp,
          confidence: Math.round(obj.confidence * 100),
          aiGenerated: 1,
        })),
        // Scene classification tags
        {
          videoId,
          name: analysis.sceneClassification.scene,
          category: 'scene',
          timestamp: analysis.timestamp,
          confidence: Math.round(analysis.sceneClassification.confidence * 100),
          aiGenerated: 1,
        },
        // Event tags
        ...analysis.events.map(event => ({
          videoId,
          name: event.eventType,
          category: 'event',
          timestamp: event.startTime,
          confidence: Math.round(event.confidence * 100),
          aiGenerated: 1,
        })),
        // Narrative-based tags
        ...analysis.narrative.keyElements.map(element => ({
          videoId,
          name: element,
          category: 'narrative',
          timestamp: analysis.timestamp,
          confidence: 90, // High confidence for narrative elements
          aiGenerated: 1,
        })),
      ];

      // Batch insert all tags
      const insertedTags = await db.insert(tags)
        .values(tagsToCreate)
        .returning();

      console.log('Created tags:', {
        count: insertedTags.length,
        categories: Array.from(new Set(insertedTags.map(tag => tag.category))),
      });

      return { keyframe, tags: insertedTags };
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
