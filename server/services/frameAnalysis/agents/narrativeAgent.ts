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
            content: `You are a narrative analysis system. Analyze the scene and return a JSON object with the following structure:
{
  "summary": "string (human-readable scene summary)",
  "keyElements": ["string array of key elements"],
  "actions": {
    "primary": "string (main action)",
    "secondary": ["string array of secondary actions"]
  },
  "context": "string (overall scene context)"
}
Return ONLY valid JSON, no other text or explanations.`
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

      let narrative;
      try {
        narrative = JSON.parse(content);
      } catch (error) {
        console.error('JSON Parse Error:', error);
        console.error('Raw content causing parse error:', content);
        throw new Error(`Failed to parse narrative response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
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
