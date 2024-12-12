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
        model: "gpt-4o-2024-08-06",
        messages: [
          {
            role: "system",
            content: `You are a scene analysis system. Analyze the image and return a JSON object with the following structure:
{
  "scene": "string (scene description)",
  "confidence": number (between 0 and 1),
  "attributes": {
    "lighting": "string",
    "composition": "string",
    "mood": "string",
    "setting": "string",
    "cameraAngle": "string",
    "visualQuality": "string"
  }
}
Return ONLY valid JSON, no other text or explanations.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image and classify the scene. Consider these detected objects: ${JSON.stringify(objectDetection.objects)}`
              },
              {
                type: "image_url",
                image_url: { url: frameBase64.startsWith('data:') ? frameBase64 : `data:image/jpeg;base64,${frameBase64}` }
              }
            ]
          }
        ],
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No analysis received from OpenAI API");
      }

      // Log raw response for debugging
      console.log('Raw GPT-4 response:', {
        content: content.substring(0, 200) + '...',
        length: content.length,
        type: typeof content
      });

      let parsedScene;
      try {
        parsedScene = JSON.parse(content);
      } catch (error) {
        console.error('JSON Parse Error:', error);
        console.error('Raw content causing parse error:', content);
        throw new Error(`Failed to parse scene classification response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
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
          cameraAngle: parsedScene.attributes.cameraAngle || "auto-detected",
          visualQuality: parsedScene.attributes.visualQuality || "high",
        }
      };
    } catch (error) {
      console.error("Error in scene classification:", error);
      throw error;
    }
  }
}
