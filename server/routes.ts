import type { Express } from "express";
import { db } from "../db";
import { videos, tags, keyframes } from "@db/schema";
import { eq } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { processVideo } from "./services/videoProcessor";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Ensure frames directory exists
const framesDir = path.join(uploadsDir, 'frames');
if (!fs.existsSync(framesDir)) {
  fs.mkdirSync(framesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

export function registerRoutes(app: Express) {
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

      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }

      console.log('Processing video upload:', { title, filename: file.filename });

      const [video] = await db.insert(videos).values({
        title: title.trim(),
        description: description?.trim() || '',
        url: `/uploads/${file.filename}`,
        thumbnailUrl: null,
        duration: null,
      }).returning();

      console.log('Video record created:', video);

      // Process video frames in the background
      processVideo(video.id, path.join(uploadsDir, file.filename))
        .catch(error => {
          console.error('Error processing video:', error);
          // Don't let processing errors affect the upload response
          // The video is saved, processing can be retried later if needed
        });

      res.json(video);
    } catch (error) {
      console.error('Error in video upload:', error);
      res.status(500).json({ error: "Failed to upload video. Please try again." });
    }
  });

  app.get('/api/videos', async (req, res) => {
    try {
      const allVideos = await db.select().from(videos);
      res.json(allVideos);
    } catch (error) {
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
