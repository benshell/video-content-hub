import ffmpeg from "fluent-ffmpeg";
import { OpenAI } from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { db } from "../../db";
import { videos, keyframes, tags } from "@db/schema";
import { eq } from "drizzle-orm";

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

    console.log(`Video duration: ${duration} seconds`);

    await db.update(videos)
      .set({ duration })
      .where(eq(videos.id, videoId));

    // Extract frames every second
    console.log("Starting frame extraction...");
    const frames = await extractFrames(videoPath, framesDir);
    console.log(`Successfully extracted ${frames.length} frames from video`);
    
    // Process frames in smaller batches to avoid memory issues
    const BATCH_SIZE = 3; // Reduced batch size for more reliable processing
    let processedFrames = 0;
    let totalTags = 0;

    for (let i = 0; i < frames.length; i += BATCH_SIZE) {
      const batch = frames.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(frames.length/BATCH_SIZE)}`);

      await Promise.all(batch.map(async (frame) => {
        try {
          console.log(`Processing frame at timestamp: ${frame.timestamp}`);
          
          // Compress and convert frame to base64
          const buffer = await sharp(frame.path)
            .resize(800, null, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();
          
          const base64Image = buffer.toString('base64');
          
          // Analyze frame using GPT-4 Vision
          const analysis = await analyzeFrame(base64Image);
          
          // Save keyframe with relative path
          const relativePath = frame.path.replace(process.cwd(), '');
          const [keyframe] = await db.insert(keyframes).values({
            videoId,
            timestamp: frame.timestamp,
            thumbnailUrl: relativePath,
            metadata: analysis.metadata
          }).returning();

          console.log(`Saved keyframe at ${frame.timestamp} with metadata:`, analysis.metadata);

          // Create tags from analysis
          const tagPromises = analysis.tags.map(tag =>
            db.insert(tags).values({
              videoId,
              name: tag.name,
              category: tag.category,
              timestamp: frame.timestamp,
              confidence: tag.confidence,
              aiGenerated: 1
            })
          );

          const insertedTags = await Promise.all(tagPromises);
          totalTags += insertedTags.length;

          console.log(`Added ${insertedTags.length} tags for frame at ${frame.timestamp}`);
          processedFrames++;

        } catch (error) {
          console.error(`Error processing frame at ${frame.timestamp}:`, error);
          throw error; // Propagate error to retry mechanism
        }
      }));

      // Log progress after each batch
      console.log(`Progress: ${processedFrames}/${frames.length} frames processed, ${totalTags} tags created`);
    }
    
    console.log(`Completed video processing for videoId: ${videoId}`);
    console.log(`Final statistics: ${processedFrames} frames processed, ${totalTags} tags created`);

    // Clean up frames directory
    try {
      await fs.rm(framesDir, { recursive: true, force: true });
      console.log(`Cleaned up frames directory: ${framesDir}`);
    } catch (error) {
      console.error(`Error cleaning up frames directory: ${framesDir}`, error);
    }

  } catch (error) {
    console.error('Error processing video:', error);
    throw error;
  }
}

async function extractFrames(videoPath: string, outputDir: string): Promise<ExtractedFrame[]> {
  return new Promise((resolve, reject) => {
    const frames: ExtractedFrame[] = [];
    let framesCompleted = false;
    
    ffmpeg(videoPath)
      .outputOptions([
        '-vf', 'fps=1', // Extract 1 frame per second
        '-frame_pts', '1',
        '-qscale:v', '2' // High quality frames
      ])
      .output(path.join(outputDir, 'frame-%d.jpg'))
      .on('end', () => {
        console.log(`Completed frame extraction, found ${frames.length} frames`);
        framesCompleted = true;
        // Only resolve after both extraction is complete and all frames are processed
        resolve(frames);
      })
      .on('error', (err) => {
        console.error('Error extracting frames:', err);
        reject(err);
      })
      .on('progress', (progress) => {
        if (progress.frames) {
          const frameNumber = progress.frames;
          const framePath = path.join(outputDir, `frame-${frameNumber}.jpg`);
          frames.push({
            timestamp: frameNumber,
            path: framePath
          });
          console.log(`Extracted frame ${frameNumber} to ${framePath}`);
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
    console.log("Starting frame analysis with GPT-4 Vision...");
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `Analyze this video frame and provide detailed analysis in the following JSON format:
{
  "tags": [
    {"name": "string", "category": "person|object|action|scene", "confidence": number}
  ],
  "description": "detailed scene description",
  "objects": ["list of visible objects"],
  "actions": ["list of actions being performed"]
}
Be specific and detailed in your analysis. Include all visible elements.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.5,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0]?.message?.content) {
      console.error("No content in OpenAI response");
      throw new Error("No analysis received");
    }

    console.log("Received GPT-4 Vision response:", response.choices[0].message.content);

    const analysis = JSON.parse(response.choices[0].message.content);
    
    // Validate and transform the analysis
    const transformedTags = (analysis.tags || []).map((tag: any) => {
      const validCategories = ['person', 'object', 'action', 'scene'];
      return {
        name: String(tag.name || "").toLowerCase(),
        category: validCategories.includes(String(tag.category)) ? String(tag.category) : 'object',
        confidence: Math.min(Math.max(Number(tag.confidence) || 90, 0), 100), // Ensure confidence is between 0-100
      };
    });

    const result = {
      tags: transformedTags,
      metadata: {
        description: String(analysis.description || ""),
        objects: Array.isArray(analysis.objects) ? analysis.objects.map(String) : [],
        actions: Array.isArray(analysis.actions) ? analysis.actions.map(String) : [],
      },
    };

    console.log("Processed analysis result:", result);
    return result;

  } catch (error) {
    console.error("Error in frame analysis:", error);
    throw error; // Let the caller handle the error
  }
}
