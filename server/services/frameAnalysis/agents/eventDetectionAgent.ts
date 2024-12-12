import { OpenAI } from "openai";
import { TemporalEvent, ObjectDetectionResult, SceneClassification } from "../types";

export class EventDetectionAgent {
  private openai: OpenAI;
  private frameBuffer: Array<{
    frameNumber: number;
    timestamp: number;
    objectDetection: ObjectDetectionResult;
    sceneClassification: SceneClassification;
  }> = [];

  constructor(openai: OpenAI) {
    this.openai = openai;
  }

  async addFrame(
    frameNumber: number,
    timestamp: number,
    objectDetection: ObjectDetectionResult,
    sceneClassification: SceneClassification
  ) {
    this.frameBuffer.push({
      frameNumber,
      timestamp,
      objectDetection,
      sceneClassification,
    });

    // Keep only last 30 frames (roughly 1 second at 30fps)
    if (this.frameBuffer.length > 30) {
      this.frameBuffer.shift();
    }
  }

  async detectEvents(): Promise<TemporalEvent[]> {
    if (this.frameBuffer.length < 2) {
      return [];
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an event detection system. Analyze the sequence of frames to identify temporal events and patterns."
          },
          {
            role: "user",
            content: `Analyze this sequence of frames for events: ${JSON.stringify(this.frameBuffer)}`
          }
        ],
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No analysis received from OpenAI API");
      }

      const events = JSON.parse(content);
      return events.map((event: any) => ({
        startFrame: event.startFrame,
        endFrame: event.endFrame,
        startTime: event.startTime,
        endTime: event.endTime,
        eventType: event.eventType,
        confidence: event.confidence,
        description: event.description,
        involvedObjects: event.involvedObjects,
      }));
    } catch (error) {
      console.error("Error in event detection:", error);
      throw error;
    }
  }
}
