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
      
      if (!Buffer.isBuffer(frameBuffer)) {
        throw new Error('Invalid buffer provided');
      }
      
      if (frameBuffer.length === 0) {
        throw new Error('Empty buffer provided');
      }
      
      const base64Image = Buffer.isBuffer(frameBuffer) 
        ? `data:image/jpeg;base64,${frameBuffer.toString('base64')}`
        : null;
      
      if (!base64Image || !base64Image.startsWith('data:image/jpeg;base64,')) {
        throw new Error('Invalid image format or base64 conversion failed');
      }

      console.log('Base64 image validation:', {
        size: frameBuffer.length,
        base64Length: base64Image.length,
        startsWithDataUrl: base64Image.startsWith('data:image/jpeg;base64,'),
        sampleStart: base64Image.substring(0, 50) + '...'
      });

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

      // Generate tags from all analyses
      const tags = [
        ...objectDetection.objects.map(obj => ({
          name: obj.class,
          category: obj.class.toLowerCase().includes('person') ? 'person' : 'object',
          confidence: obj.confidence * 100,
        })),
        {
          name: sceneClassification.scene,
          category: 'scene',
          confidence: sceneClassification.confidence * 100,
        },
        ...events.map(event => ({
          name: event.eventType,
          category: 'event',
          confidence: event.confidence * 100,
        })),
        ...narrative.keyElements.map(element => ({
          name: element,
          category: 'narrative',
          confidence: 90,
        }))
      ];

      const analysis: FrameAnalysis = {
        frameNumber,
        timestamp,
        objectDetection,
        sceneClassification,
        events,
        narrative,
        tags,
        metadata: {
          semanticDescription: {
            summary: narrative.summary,
            keyElements: narrative.keyElements,
            mood: sceneClassification.attributes.mood,
            composition: sceneClassification.attributes.composition,
          },
          objects: {
            people: objectDetection.objects
              .filter(obj => obj.class.toLowerCase().includes('person'))
              .map(obj => obj.class),
            items: objectDetection.objects
              .filter(obj => !obj.class.toLowerCase().includes('person'))
              .map(obj => obj.class),
            environment: [sceneClassification.scene],
          },
          actions: {
            primary: narrative.actions.primary,
            secondary: narrative.actions.secondary,
            movements: events.map(event => event.description),
          },
          technical: {
            lighting: sceneClassification.attributes.lighting,
            cameraAngle: sceneClassification.attributes.cameraAngle || "auto-detected",
            visualQuality: sceneClassification.attributes.visualQuality || "high",
          },
        }
      };

      // Save results to database within a transaction
      const result = await db.transaction(async (tx) => {
        // Save keyframe with metadata
        const [keyframe] = await tx
          .insert(keyframes)
          .values({
            videoId,
            timestamp: analysis.timestamp,
            metadata: analysis.metadata,
          })
          .returning();

        console.log('Saved keyframe:', {
          id: keyframe.id,
          timestamp: keyframe.timestamp,
          metadata: analysis.metadata,
        });

        // Create tags from all sources
        const tagsToCreate = analysis.tags.map(tag => ({
          videoId,
          name: tag.name,
          category: tag.category,
          timestamp: analysis.timestamp,
          confidence: Math.round(tag.confidence),
          aiGenerated: 1,
        }));

        // Batch insert all tags
        const insertedTags = await tx
          .insert(tags)
          .values(tagsToCreate)
          .returning();

        console.log('Created tags:', {
          count: insertedTags.length,
          categories: Array.from(new Set(insertedTags.map(tag => tag.category))),
        });

        return { keyframe, tags: insertedTags };
      });

      return analysis;
    } catch (error) {
      console.error(`Error analyzing frame ${frameNumber}:`, error);
      throw error;
    }
  }

  async analyzeBatch(frames: Array<{ buffer: Buffer; frameNumber: number; timestamp: number }>, videoId: number) {
    const results = [];
    const batchSize = 5;

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