import ffmpeg from "fluent-ffmpeg";
import { OpenAI } from "openai";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { db } from "../../db";
import { videos, keyframes, tags } from "@db/schema";
import { eq } from "drizzle-orm";

// Configure ffmpeg path and verify installation
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

try {
  console.log('FFmpeg installer version:', ffmpegPath.version);
  ffmpeg.setFfmpegPath(ffmpegPath.path);
  
  // Verify ffmpeg is working
  ffmpeg.getAvailableFormats((err, formats) => {
    if (err) {
      console.error('Error checking FFmpeg formats:', err);
    } else {
      console.log('FFmpeg initialized successfully');
    }
  });
} catch (error) {
  console.error('Failed to initialize FFmpeg:', error);
  throw new Error('FFmpeg initialization failed');
}

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
  
  try {
    console.log(`Starting video processing for videoId: ${videoId}`);
    
    // Update video status to processing
    await db.update(videos)
      .set({ processingStatus: 'processing' })
      .where(eq(videos.id, videoId));

    // Ensure the frames directory exists and is empty
    await fs.rm(framesDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(framesDir, { recursive: true });
    
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
    console.log("Starting frame extraction for video:", videoPath);
    console.log("Frames will be saved to:", framesDir);
    
    let frames;
    try {
      frames = await extractFrames(videoPath, framesDir);
      console.log(`Successfully extracted ${frames.length} frames from video`);
    } catch (error: unknown) {
      const errorDetails = {
        ffmpegPath: ffmpegPath.path,
        videoPath,
        framesDir,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      };
      console.error("Failed to extract frames:", errorDetails);
      throw new Error(`Frame extraction failed: ${errorDetails.message}`);
    }
    
    // Update total frames count
    await db.update(videos)
      .set({ totalFrames: frames.length })
      .where(eq(videos.id, videoId));

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
          
          // Update progress in database
          await db.update(videos)
            .set({ processedFrames })
            .where(eq(videos.id, videoId));

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
    
    console.log(`Starting frame extraction from: ${videoPath}`);
    console.log(`Output directory: ${outputDir}`);
    
    ffmpeg(videoPath)
      .outputOptions([
        '-vf', 'fps=1', // Extract 1 frame per second
        '-frame_pts', '1',
        '-qscale:v', '2', // High quality frames
        '-frames:v', '300' // Limit to 300 frames (5 minutes) for processing
      ])
      .on('start', (command) => {
        console.log('FFmpeg started with command:', command);
      })
      .on('progress', (progress) => {
        console.log('FFmpeg Progress:', progress);
      })
      .output(path.join(outputDir, 'frame-%d.jpg'))
      .on('end', async () => {
        try {
          console.log('Frame extraction completed, verifying frames...');
          const files = await fs.readdir(outputDir);
          const frameFiles = files.filter(f => f.startsWith('frame-') && f.endsWith('.jpg'));
          
          console.log(`Found ${frameFiles.length} potential frame files`);
          
          for (const file of frameFiles.sort()) {
            const frameNumber = parseInt(file.replace('frame-', '').replace('.jpg', ''));
            if (!isNaN(frameNumber)) {
              const framePath = path.join(outputDir, file);
              try {
                // Verify file exists and is accessible
                await fs.access(framePath);
                // Get file stats to verify it's a valid file
                const stats = await fs.stat(framePath);
                if (stats.size > 0) {
                  frames.push({
                    timestamp: frameNumber,
                    path: framePath
                  });
                  console.log(`Verified frame ${frameNumber} at ${framePath} (${stats.size} bytes)`);
                } else {
                  console.warn(`Skipping empty frame file: ${framePath}`);
                }
              } catch (error) {
                console.warn(`Failed to verify frame ${frameNumber}:`, error);
              }
            }
          }
          
          if (frames.length === 0) {
            reject(new Error('No valid frames were extracted from the video'));
          } else {
            console.log(`Successfully verified ${frames.length} frames`);
            resolve(frames.sort((a, b) => a.timestamp - b.timestamp));
          }
        } catch (error) {
          console.error('Error verifying frames:', error);
          reject(error);
        }
      })
      .on('error', (err) => {
        console.error('Error in FFmpeg frame extraction:', err);
        reject(err);
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
    semanticDescription: {
      summary: string;
      keyElements: string[];
      mood: string;
      composition: string;
    };
    objects: {
      people: string[];
      items: string[];
      environment: string[];
    };
    actions: {
      primary: string;
      secondary: string[];
      movements: string[];
    };
    technical: {
      lighting: string;
      cameraAngle: string;
      visualQuality: string;
    };
  };
}

async function analyzeFrame(base64Image: string): Promise<AnalyzedFrame> {
  try {
    console.log("Starting frame analysis with GPT-4 Vision...");
    
    // Verify OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: "You are a video frame analysis assistant. Always respond with valid JSON format following the specified schema. Be precise and detailed in your analysis."
        },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `Analyze this video frame and format your response as valid JSON with this exact structure:
{
  "tags": [
    {"name": "string", "category": "person|object|action|scene", "confidence": number}
  ],
  "semanticDescription": {
    "summary": "string",
    "keyElements": ["string"],
    "mood": "string",
    "composition": "string"
  },
  "objects": {
    "people": ["string"],
    "items": ["string"],
    "environment": ["string"]
  },
  "actions": {
    "primary": "string",
    "secondary": ["string"],
    "movements": ["string"]
  },
  "technical": {
    "lighting": "string",
    "cameraAngle": "string",
    "visualQuality": "string"
  }
}`
            },
            {
              type: "text", 
              text: "Provide rich, contextual analysis that captures both technical and semantic aspects. Focus on specific details and relationships between elements. Your response must be valid JSON."
            },
            {
              type: "image",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("Empty or invalid response from OpenAI:", response);
      throw new Error("No analysis received from OpenAI API");
    }

    console.log("Received GPT-4 Vision response");
    
    let analysis;
    try {
      // Try to extract JSON from the response if it's wrapped in text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      analysis = JSON.parse(jsonString);

      // Validate required structure
      if (!analysis.tags || !analysis.semanticDescription || !analysis.objects || 
          !analysis.actions || !analysis.technical) {
        throw new Error("Response missing required fields");
      }
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", {
        error: parseError,
        content: content.substring(0, 500) + "..." // Log first 500 chars
      });
      throw new Error(`Invalid JSON response: ${parseError.message}`);
    }
    
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
        semanticDescription: {
          summary: String(analysis.semanticDescription?.summary || ""),
          keyElements: Array.isArray(analysis.semanticDescription?.keyElements) 
            ? analysis.semanticDescription.keyElements.map(String) 
            : [],
          mood: String(analysis.semanticDescription?.mood || ""),
          composition: String(analysis.semanticDescription?.composition || "")
        },
        objects: {
          people: Array.isArray(analysis.objects?.people) ? analysis.objects.people.map(String) : [],
          items: Array.isArray(analysis.objects?.items) ? analysis.objects.items.map(String) : [],
          environment: Array.isArray(analysis.objects?.environment) ? analysis.objects.environment.map(String) : []
        },
        actions: {
          primary: String(analysis.actions?.primary || ""),
          secondary: Array.isArray(analysis.actions?.secondary) ? analysis.actions.secondary.map(String) : [],
          movements: Array.isArray(analysis.actions?.movements) ? analysis.actions.movements.map(String) : []
        },
        technical: {
          lighting: String(analysis.technical?.lighting || ""),
          cameraAngle: String(analysis.technical?.cameraAngle || ""),
          visualQuality: String(analysis.technical?.visualQuality || "")
        }
      },
    };

    console.log("Processed analysis result:", result);
    return result;

  } catch (error) {
    console.error("Error in frame analysis:", error);
    throw error; // Let the caller handle the error
  }
}
