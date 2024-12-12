import { OpenAI } from "openai";
import { NarrativeContext, ObjectDetectionResult, SceneClassification, TemporalEvent } from "../types";

export class NarrativeAgent {
  private openai: OpenAI;

  constructor(openai: OpenAI) {
    this.openai = openai;
  }

  async analyze(
    frameBase64: string,
    frameNumber: number,
    timestamp: number,
    objectDetection: ObjectDetectionResult,
    sceneClassification: SceneClassification,
    events: TemporalEvent[]
  ): Promise<NarrativeContext> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        messages: [
          {
            role: "system",
            content: "You are a narrative analysis system. Create a human-readable summary of the scene incorporating object detection, scene classification, and temporal events."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image for narrative context. Consider the following context:
                Objects: ${JSON.stringify(objectDetection)}
                Scene: ${JSON.stringify(sceneClassification)}
                Events: ${JSON.stringify(events)}`
              },
              {
                type: "image_url",
                image_url: { url: frameBase64.startsWith('data:') ? frameBase64 : `data:image/jpeg;base64,${frameBase64}` }
              }
            ]
          }
        ],
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No analysis received from OpenAI API");
      }

      const narrative = JSON.parse(content);
      
      return {
        frameNumber,
        timestamp,
        summary: narrative.summary,
        keyElements: narrative.keyElements,
        actions: {
          primary: narrative.actions.primary,
          secondary: narrative.actions.secondary,
        },
        context: narrative.context
      };
    } catch (error) {
      console.error("Error in narrative generation:", error);
      throw error;
    }
  }
}
