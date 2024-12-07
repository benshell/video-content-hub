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
    console.log(`Starting video processing for videoId: ${videoId}`);
    
    // Get video duration and update video record
    const duration = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(Math.floor(metadata.format.duration || 0));
      });
    });

    await db.update(videos)
      .set({ duration })
      .where(eq(videos.id, videoId));

    // Extract frames every second
    const frames = await extractFrames(videoPath, framesDir);
    console.log(`Extracted ${frames.length} frames from video`);
    
    // Process frames in smaller batches to avoid memory issues
    const BATCH_SIZE = 5;
    for (let i = 0; i < frames.length; i += BATCH_SIZE) {
      const batch = frames.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (frame) => {
        try {
          // Compress and convert frame to base64
          const buffer = await sharp(frame.path)
            .resize(800, null, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();
          
          const base64Image = buffer.toString('base64');
          console.log(`Processing frame at timestamp: ${frame.timestamp}`);
          
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
          await Promise.all(analysis.tags.map(tag =>
            db.insert(tags).values({
              videoId,
              name: tag.name,
              category: tag.category,
              timestamp: frame.timestamp,
              confidence: tag.confidence,
              aiGenerated: 1
            })
          ));

          console.log(`Successfully processed frame at ${frame.timestamp} with ${analysis.tags.length} tags`);
        } catch (error) {
          console.error(`Error processing frame at ${frame.timestamp}:`, error);
        } finally {
          // Clean up the frame file regardless of success/failure
          try {
            await fs.unlink(frame.path);
          } catch (unlinkError) {
            console.error(`Error cleaning up frame file ${frame.path}:`, unlinkError);
          }
        }
      }));
    }
    
    console.log(`Completed video processing for videoId: ${videoId}`);
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
      .on('progress', (progress) => {
        if (progress.frames) {
          const frameNumber = progress.frames;
          frames.push({
            timestamp: frameNumber,
            path: path.join(outputDir, `frame-${frameNumber}.jpg`)
          });
        }
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
            { type: "text", text: "Analyze this video frame and provide:\n1. A list of tags with categories (person, object, action, scene)\n2. A brief description\n3. Key objects present\n4. Actions being performed\nFormat the response in JSON." },
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
      max_tokens: 500,
      temperature: 0.7
    });

    if (!response.choices[0]?.message?.content) {
      console.error("No content in OpenAI response");
      throw new Error("No analysis received");
    }

    try {
      const analysis = JSON.parse(response.choices[0].message.content);
      return {
        tags: (analysis.tags || []).map((tag: any) => ({
          name: String(tag.name || ""),
          category: String(tag.category || "object"),
          confidence: Number(tag.confidence) || 90,
        })),
        metadata: {
          description: String(analysis.description || ""),
          objects: Array.isArray(analysis.objects) ? analysis.objects.map(String) : [],
          actions: Array.isArray(analysis.actions) ? analysis.actions.map(String) : [],
        },
      };
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      throw new Error("Invalid response format");
    }
  } catch (error) {
    console.error("Error in frame analysis:", error);
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
