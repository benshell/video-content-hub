import { OpenAI } from "openai";
import { ObjectDetectionResult } from "../types";

export class ObjectDetectionAgent {
  private openai: OpenAI;

  constructor(openai: OpenAI) {
    this.openai = openai;
  }

  async analyze(frameBase64: string, frameNumber: number, timestamp: number): Promise<ObjectDetectionResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "system",
            content: "You are a computer vision system specializing in object detection. Analyze the image and return objects with their locations and confidence scores."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image for object detection:"
              },
              {
                type: "text",
                text: `data:image/jpeg;base64,${frameBase64}`
              },
              {
                type: "text",
                text: "Detect and locate objects in this frame. Return results in a structured format with bounding boxes and confidence scores."
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

      // Parse the response and convert to ObjectDetectionResult format
      const parsedObjects = JSON.parse(content);
      
      return {
        frameNumber,
        timestamp,
        objects: parsedObjects.objects.map((obj: any) => ({
          class: obj.class,
          confidence: obj.confidence,
          bbox: {
            x1: obj.bbox[0],
            y1: obj.bbox[1],
            x2: obj.bbox[2],
            y2: obj.bbox[3],
          }
        }))
      };
    } catch (error) {
      console.error("Error in object detection:", error);
      throw error;
    }
  }
}
