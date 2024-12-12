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
        model: "gpt-4o-2024-08-06",
        messages: [
          {
            role: "system",
            content: `You are a computer vision system specializing in object detection. Analyze the image and return a JSON object with the following structure:
{
  "objects": [
    {
      "class": "string (object class name)",
      "confidence": "number (between 0 and 1)",
      "bbox": [number, number, number, number] (coordinates: x1, y1, x2, y2)
    }
  ]
}
Return ONLY valid JSON, no other text or explanations.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image and detect objects. Return the results in the specified JSON format with bounding boxes and confidence scores."
              },
              {
                type: "image_url",
                image_url: {
                  url: frameBase64.replace(/^data:image\/[a-z]+;base64,/, '')
                }
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

      let parsedObjects;
      try {
        parsedObjects = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Raw content causing parse error:', content);
        throw new Error(`Failed to parse GPT-4 response: ${parseError.message}`);
      }

      // Validate response structure
      if (!parsedObjects.objects || !Array.isArray(parsedObjects.objects)) {
        console.error('Invalid response structure:', parsedObjects);
        throw new Error('Invalid response structure: missing objects array');
      }

      // Validate each object in the response
      parsedObjects.objects.forEach((obj: any, index: number) => {
        if (!obj.class || typeof obj.confidence !== 'number' || !Array.isArray(obj.bbox) || obj.bbox.length !== 4) {
          console.error(`Invalid object at index ${index}:`, obj);
          throw new Error(`Invalid object structure at index ${index}`);
        }
      });
      
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
      console.error("Frame details:", {
        frameNumber,
        timestamp,
        base64Length: frameBase64.length,
        base64Preview: frameBase64.substring(0, 50) + '...'
      });
      throw error;
    }
  }
}
