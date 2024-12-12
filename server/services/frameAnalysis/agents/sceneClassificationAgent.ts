import { OpenAI } from "openai";
import { SceneClassification, ObjectDetectionResult } from "../types";

export class SceneClassificationAgent {
  private openai: OpenAI;

  constructor(openai: OpenAI) {
    this.openai = openai;
  }

  async analyze(
    frameBase64: string, 
    frameNumber: number, 
    timestamp: number,
    objectDetection: ObjectDetectionResult
  ): Promise<SceneClassification> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "system",
            content: "You are a scene analysis system. Analyze the image and classify the scene, considering detected objects and overall composition."
          },
          {
            role: "user",
            content: [
              {
                type: "image",
                image_url: {
                  url: `data:image/jpeg;base64,${frameBase64}`
                }
              },
              {
                type: "text",
                text: `Classify this scene. Consider these detected objects: ${JSON.stringify(objectDetection.objects)}`
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

      const parsedScene = JSON.parse(content);
      
      return {
        frameNumber,
        timestamp,
        scene: parsedScene.scene,
        confidence: parsedScene.confidence,
        attributes: {
          lighting: parsedScene.attributes.lighting,
          composition: parsedScene.attributes.composition,
          mood: parsedScene.attributes.mood,
          setting: parsedScene.attributes.setting,
        }
      };
    } catch (error) {
      console.error("Error in scene classification:", error);
      throw error;
    }
  }
}
