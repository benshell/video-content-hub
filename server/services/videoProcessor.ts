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

async function extractFrames(videoPath: string, outputDir: string, retryCount = 3): Promise<ExtractedFrame[]> {
  // Validate input video file
  try {
    await fs.access(videoPath);
    const stats = await fs.stat(videoPath);
    if (stats.size === 0) {
      throw new Error('Video file is empty');
    }
    console.log(`Video file validated: ${videoPath} (${stats.size} bytes)`);
  } catch (error) {
    throw new Error(`Invalid video file: ${error.message}`);
  }

  // Function to attempt frame extraction with different settings
  const attemptExtraction = async (attempt: number): Promise<ExtractedFrame[]> => {
    const frames: ExtractedFrame[] = [];
    console.log(`Attempt ${attempt + 1} of ${retryCount}: Starting frame extraction`);
    console.log(`Source: ${videoPath}`);
    console.log(`Output directory: ${outputDir}`);

    // Adjust settings based on attempt number
    const settings = {
      fps: attempt === 0 ? 2 : 1, // Extract 2 frames per second initially, fallback to 1
      quality: Math.max(2, attempt === 0 ? 2 : 3 + attempt), // Keep high quality initially
      maxFrames: attempt === 0 ? 600 : Math.max(300, 600 - (attempt * 100)), // Allow more frames initially
    };

    console.log(`Extraction settings for attempt ${attempt + 1}:`, settings);

    return new Promise((resolve, reject) => {
      let ffmpegCommand = ffmpeg(videoPath)
        .outputOptions([
          '-vf', `fps=${settings.fps}`,
          '-frame_pts', '1',
          '-qscale:v', settings.quality.toString(),
          '-frames:v', settings.maxFrames.toString()
        ]);

      // Add hardware acceleration if available (attempt 0 only)
      if (attempt === 0) {
        ffmpegCommand = ffmpegCommand
          .outputOptions(['-hwaccel', 'auto']);
      }

      // Add more detailed progress logging
      let lastProgress = 0;
      let framesProcessed = 0;
      ffmpegCommand
        .on('start', (command) => {
          console.log('FFmpeg command:', command);
          console.log(`Extraction settings:`, {
            fps: settings.fps,
            quality: settings.quality,
            maxFrames: settings.maxFrames,
            attempt: attempt + 1,
            totalAttempts: retryCount
          });
        })
        .on('progress', (progress) => {
          const currentProgress = Math.floor(progress.percent || 0);
          if (currentProgress > lastProgress) {
            lastProgress = currentProgress;
            if (progress.frames) {
              framesProcessed = progress.frames;
              console.log(`Processing: ${currentProgress}% complete (${framesProcessed} frames processed)`);
            } else {
              console.log(`Processing: ${currentProgress}% complete`);
            }
          }
        })
        .on('end', () => {
          console.log(`Frame extraction completed. Processed ${framesProcessed} frames.`);
        })
        .output(path.join(outputDir, 'frame-%d.jpg'))
        .on('end', async () => {
          try {
            console.log('Frame extraction completed, starting verification...');
            let files;
            try {
              files = await fs.readdir(outputDir);
            } catch (error) {
              console.error('Error reading output directory:', error);
              throw new Error(`Failed to read frame directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }

            // Use a more strict regex pattern for frame files and proper numeric sorting
            const framePattern = /^frame-(\d+)\.jpg$/;
            const frameFiles = files
              .filter(f => {
                const match = f.match(framePattern);
                if (!match) return false;
                const num = parseInt(match[1]);
                return !isNaN(num) && num >= 0;
              })
              .sort((a, b) => {
                // Ensure we extract numbers properly for sorting
                const numA = parseInt(a.match(framePattern)![1]);
                const numB = parseInt(b.match(framePattern)![1]);
                if (isNaN(numA) || isNaN(numB)) {
                  console.warn(`Invalid frame number detected during sorting: ${a} or ${b}`);
                  return 0;
                }
                return numA - numB;
              });

            if (frameFiles.length === 0) {
              throw new Error('No valid frame files found matching the required pattern');
            }

            console.log(`Found ${frameFiles.length} valid frame files matching pattern`);
            // Log first few and last few frames for verification
            if (frameFiles.length > 0) {
              console.log('First 3 frames:', frameFiles.slice(0, 3));
              console.log('Last 3 frames:', frameFiles.slice(-3));
            }
            
            console.log(`Found ${frameFiles.length} potential frame files matching pattern`);
            
            // Process frames in batches to avoid memory issues
            const BATCH_SIZE = 50;
            const validationErrors: string[] = [];

            for (let i = 0; i < frameFiles.length; i += BATCH_SIZE) {
              const batch = frameFiles.slice(i, i + BATCH_SIZE);
              
              await Promise.all(batch.map(async (file) => {
                const frameMatch = file.match(framePattern);
                if (!frameMatch) {
                  validationErrors.push(`Invalid frame filename format: ${file}`);
                  return;
                }

                const frameNumber = parseInt(frameMatch[1]);
                if (isNaN(frameNumber) || frameNumber < 0) {
                  validationErrors.push(`Invalid frame number in filename: ${file}`);
                  return;
                }

                const framePath = path.join(outputDir, file);
                
                try {
                  // Verify file existence and accessibility
                  await fs.access(framePath, fs.constants.R_OK);
                  
                  // Get file stats
                  const stats = await fs.stat(framePath);
                  
                  if (stats.size === 0) {
                    validationErrors.push(`Empty frame file: ${file}`);
                    await fs.unlink(framePath).catch(err => 
                      console.error(`Failed to delete empty frame ${file}:`, err)
                    );
                    return;
                  }

                  if (!stats.isFile()) {
                    validationErrors.push(`Not a regular file: ${file}`);
                    return;
                  }

                  // Verify image integrity using sharp
                  try {
                    const metadata = await sharp(framePath).metadata();
                    if (!metadata.width || !metadata.height) {
                      throw new Error('Invalid image dimensions');
                    }

                    frames.push({
                      timestamp: frameNumber,
                      path: framePath
                    });
                    console.log(`Verified frame ${frameNumber} (${stats.size} bytes, ${metadata.width}x${metadata.height})`);
                  } catch (sharpError) {
                    validationErrors.push(`Invalid image data in frame ${frameNumber}: ${sharpError instanceof Error ? sharpError.message : 'Unknown error'}`);
                    await fs.unlink(framePath).catch(err => 
                      console.error(`Failed to delete invalid frame ${file}:`, err)
                    );
                  }
                } catch (error) {
                  if (error instanceof Error && 'code' in error) {
                    switch (error.code) {
                      case 'ENOENT':
                        validationErrors.push(`Frame file not found: ${file}`);
                        break;
                      case 'EACCES':
                        validationErrors.push(`Permission denied accessing frame: ${file}`);
                        break;
                      default:
                        validationErrors.push(`Error processing frame ${file}: ${error.message}`);
                    }
                  } else {
                    validationErrors.push(`Unknown error processing frame ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                }
              }));
            }

            // Log validation errors if any
            if (validationErrors.length > 0) {
              console.warn('Frame validation errors:', validationErrors);
            }

            if (frames.length === 0) {
              reject(new Error('No valid frames extracted'));
            } else {
              console.log(`Successfully verified ${frames.length} frames`);
              resolve(frames.sort((a, b) => a.timestamp - b.timestamp));
            }
          } catch (error) {
            console.error('Error during frame verification:', error);
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error(`FFmpeg error (attempt ${attempt + 1}):`, err.message);
          reject(err);
        })
        .run();
    });
  };

  // Implement retry logic with exponential backoff
  let lastError;
  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      if (attempt > 0) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`Waiting ${backoffMs}ms before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
      return await attemptExtraction(attempt);
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt + 1} failed:`, error.message);
      
      // Clean up any partial results
      try {
        const files = await fs.readdir(outputDir);
        await Promise.all(files.map(file => 
          fs.unlink(path.join(outputDir, file)).catch(console.error)
        ));
      } catch (cleanupError) {
        console.warn('Failed to clean up after failed attempt:', cleanupError.message);
      }
    }
  }

  throw new Error(`Frame extraction failed after ${retryCount} attempts. Last error: ${lastError?.message}`);
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
