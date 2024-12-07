import type { Express } from "express";
import { db } from "../db";
import { videos, tags, keyframes } from "@db/schema";
import { eq } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import cors from "cors";
import { processVideo } from "./services/videoProcessor";

// Configure express middleware
const corsOptions = {
  origin: true,
  credentials: true,
};

// Ensure all required directories exist
const uploadsDir = path.join(process.cwd(), 'uploads');
const videosDir = path.join(uploadsDir, 'videos');
const framesDir = path.join(uploadsDir, 'frames');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

[uploadsDir, videosDir, framesDir, thumbnailsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videosDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and add timestamp to ensure uniqueness
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `${Date.now()}_${sanitizedName}`);
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only MP4, MOV, WebM, and AVI videos are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  }
});

export function registerRoutes(app: Express) {
  // Configure middleware
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '500mb' }));
  app.use(express.urlencoded({ extended: true, limit: '500mb' }));
  
  // Serve static files from uploads directory
  app.use('/uploads', express.static(uploadsDir));
  // Video management
  app.post('/api/videos', upload.single('video'), async (req, res) => {
    try {
      const file = req.file;
      const { title, description } = req.body;
      
      if (!file) {
        return res.status(400).json({ error: "No video file uploaded" });
      }

      if (!title?.trim()) {
        return res.status(400).json({ error: "Title is required" });
      }

      console.log('Processing video upload:', { title, filename: file.filename });

      // Construct the proper URL paths
      const videoUrl = `/uploads/videos/${file.filename}`;
      const videoPath = path.join(videosDir, file.filename);

      const [video] = await db.insert(videos).values({
        title: title.trim(),
        description: description?.trim() || '',
        url: videoUrl,
        thumbnailUrl: null,
        duration: null,
      }).returning();

      console.log('Video record created:', video);

      // Process video frames in the background
      console.log('Starting video processing for:', { videoId: video.id, videoPath });
      
      processVideo(video.id, videoPath)
        .then(() => {
          console.log('Video processing completed successfully:', video.id);
          // Update processing status to completed
          return db.update(videos)
            .set({ processingStatus: 'completed' })
            .where(eq(videos.id, video.id));
        })
        .catch(async error => {
          console.error('Error processing video:', error);
          // Update processing status to failed
          await db.update(videos)
            .set({ processingStatus: 'failed' })
            .where(eq(videos.id, video.id));
          // Log the full error details
          console.error('Full error details:', {
            message: error.message,
            stack: error.stack,
            videoId: video.id
          });
        });

      res.json(video);
    } catch (error) {
      console.error('Error in video upload:', error);
      // If there's a multer error, it will have a specific format
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: "File is too large. Maximum size is 500MB." });
        }
        return res.status(400).json({ error: error.message });
      }
      // For other errors, send a generic message
      res.status(500).json({ error: "Failed to upload video. Please try again." });
    }
  });

  app.get('/api/videos', async (req, res) => {
    try {
      const allVideos = await db.query.videos.findMany({
        with: {
          keyframes: true,
          tags: true
        }
      });
      res.json(allVideos);
    } catch (error) {
      console.error('Error fetching videos:', error);
      res.status(500).json({ error: "Failed to fetch videos" });
    }
  });

  app.get('/api/videos/:id', async (req, res) => {
    try {
      const videoId = parseInt(req.params.id);
      if (isNaN(videoId)) {
        return res.status(400).json({ error: "Invalid video ID" });
      }

      const video = await db.query.videos.findFirst({
        where: eq(videos.id, videoId),
        with: {
          tags: true,
          keyframes: true
        }
      });
      
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      res.json(video);
    } catch (error) {
      console.error('Error fetching video:', error);
      res.status(500).json({ error: "Failed to fetch video details" });
    }
  });
  app.get('/api/videos/:id/export', async (req, res) => {
    try {
      const videoId = parseInt(req.params.id);
      if (isNaN(videoId)) {
        return res.status(400).json({ error: "Invalid video ID" });
      }

      const video = await db.query.videos.findFirst({
        where: eq(videos.id, videoId),
        with: {
          tags: true,
          keyframes: true,
        }
      });

      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      const exportData = {
        videoId: video.id,
        title: video.title,
        description: video.description,
        duration: video.duration,
        url: video.url,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
        tags: video.tags.map(tag => ({
          name: tag.name,
          category: tag.category,
          timestamp: tag.timestamp,
          confidence: tag.confidence,
          aiGenerated: tag.aiGenerated
        })),
        keyframes: video.keyframes.map(keyframe => ({
          timestamp: keyframe.timestamp,
          thumbnailUrl: keyframe.thumbnailUrl,
          metadata: keyframe.metadata
        }))
      };

      res.json(exportData);
    } catch (error) {
      console.error('Error exporting video data:', error);
      res.status(500).json({ error: "Failed to export video data" });
    }
  });


  app.delete('/api/videos/:id', async (req, res) => {
    try {
      const videoId = parseInt(req.params.id);
      if (isNaN(videoId)) {
        return res.status(400).json({ error: "Invalid video ID" });
      }

      // First, fetch the video to get its file path
      const video = await db.query.videos.findFirst({
        where: eq(videos.id, videoId)
      });

      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Delete related records (tags and keyframes will be cascade deleted)
      await db.delete(videos).where(eq(videos.id, videoId));

      // Clean up all unused files
      const { cleanupUnusedVideos } = await import('./utils/cleanup');
      await cleanupUnusedVideos();

      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      console.error('Error deleting video:', error);
      res.status(500).json({ error: "Failed to delete video" });
    }
  });
  // Tag management
  app.post('/api/videos/:id/tags', async (req, res) => {
    try {
      const { name, category, timestamp, confidence, aiGenerated } = req.body;
      const videoId = parseInt(req.params.id);

      const [tag] = await db.insert(tags).values({
        videoId: Number(videoId),
        name: String(name),
        category: String(category),
        timestamp: Number(timestamp),
        confidence: confidence ? Number(confidence) : null,
        aiGenerated: aiGenerated ? Number(aiGenerated) : 0
      }).returning();

      res.json(tag);
    } catch (error) {
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  // Keyframe management
  app.post('/api/videos/:id/keyframes', async (req, res) => {
    try {
      const { timestamp, thumbnailUrl, metadata } = req.body;
      const videoId = parseInt(req.params.id);

      const [keyframe] = await db.insert(keyframes).values({
        videoId: Number(videoId),
        timestamp: Number(timestamp),
        thumbnailUrl: thumbnailUrl || null,
        metadata: metadata || null
      }).returning();

      res.json(keyframe);
    } catch (error) {
      res.status(500).json({ error: "Failed to create keyframe" });
    }
  });
}
