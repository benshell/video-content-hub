import ffmpeg from "fluent-ffmpeg";
import { OpenAI } from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { db } from "../../db";
import { keyframes, tags } from "@db/schema";

// Configure ffmpeg path
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractedFrame {
  timestamp: number;
  path: string;
}

export async function processVideo(videoId: number, videoPath: string) {
  const framesDir = path.join(process.cwd(), 'uploads', 'frames', videoId.toString());
  await fs.mkdir(framesDir, { recursive: true });

  try {
    // Extract frames every second
    const frames = await extractFrames(videoPath, framesDir);
    
    // Analyze frames and generate tags
    for (const frame of frames) {
      try {
        // Compress and convert frame to base64
        const buffer = await sharp(frame.path)
          .resize(800, null, { fit: 'inside' })
          .jpeg({ quality: 80 })
          .toBuffer();
        
        const base64Image = buffer.toString('base64');
        
        // Analyze frame using GPT-4 Vision
        const analysis = await analyzeFrame(base64Image);
        
        // Save keyframe
        const [keyframe] = await db.insert(keyframes).values({
          videoId,
          timestamp: frame.timestamp,
          thumbnailUrl: frame.path.replace(process.cwd(), ''),
          metadata: analysis.metadata
        }).returning();

        // Create tags from analysis
        for (const tag of analysis.tags) {
          await db.insert(tags).values({
            videoId,
            name: tag.name,
            category: tag.category,
            timestamp: frame.timestamp,
            confidence: tag.confidence,
            aiGenerated: 1
          });
        }

        // Clean up the frame file
        await fs.unlink(frame.path);
      } catch (error) {
        console.error(`Error processing frame at ${frame.timestamp}:`, error);
      }
    }
  } catch (error) {
    console.error('Error processing video:', error);
    throw error;
  }
}

async function extractFrames(videoPath: string, outputDir: string): Promise<ExtractedFrame[]> {
  return new Promise((resolve, reject) => {
    const frames: ExtractedFrame[] = [];
    
    ffmpeg(videoPath)
      .outputOptions([
        '-vf', 'fps=1', // Extract 1 frame per second
        '-frame_pts', '1'
      ])
      .output(path.join(outputDir, 'frame-%d.jpg'))
      .on('end', () => resolve(frames))
      .on('error', (err) => {
        console.error('Error extracting frames:', err);
        reject(err);
      })
      .on('frame', (frameNumber: number) => {
        frames.push({
          timestamp: frameNumber,
          path: path.join(outputDir, `frame-${frameNumber + 1}.jpg`)
        });
      })
      .run();
  });
}

interface AnalyzedFrame {
  tags: Array<{
    name: string;
    category: string;
    confidence: number;
  }>;
  metadata: {
    description: string;
    objects: string[];
    actions: string[];
  };
}

async function analyzeFrame(base64Image: string): Promise<AnalyzedFrame> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this video frame and provide:\n1. A list of tags with categories (person, object, action, scene)\n2. A brief description\n3. Key objects present\n4. Actions being performed\nFormat the response in JSON."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "low"
              }
            }
          ]
        }
      ],
      max_tokens: 500
    });

    const analysisText = response.choices[0].message.content;
    if (!analysisText) throw new Error("No analysis received");
    
    const analysis = JSON.parse(analysisText);
    
    return {
      tags: analysis.tags.map((tag: any) => ({
        name: tag.name,
        category: tag.category,
        confidence: tag.confidence || 90,
      })),
      metadata: {
        description: analysis.description,
        objects: analysis.objects,
        actions: analysis.actions,
      },
    };
  } catch (error) {
    console.error("Error analyzing frame:", error);
    return {
      tags: [],
      metadata: {
        description: "",
        objects: [],
        actions: [],
      },
    };
  }
}
