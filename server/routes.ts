import type { Express } from "express";
import { db } from "../db";
import { videos, tags, keyframes } from "@db/schema";
import { eq } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
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
      
      const [video] = await db.insert(videos).values({
        title,
        description,
        url: `/uploads/${file.filename}`,
      }).returning();

      res.json(video);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload video" });
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
      const video = await db.select()
        .from(videos)
        .where(eq(videos.id, parseInt(req.params.id)))
        .limit(1);
      
      if (!video.length) {
        return res.status(404).json({ error: "Video not found" });
      }

      const videoTags = await db.select()
        .from(tags)
        .where(eq(tags.videoId, video[0].id));

      const videoKeyframes = await db.select()
        .from(keyframes)
        .where(eq(keyframes.videoId, video[0].id));

      res.json({
        ...video[0],
        tags: videoTags,
        keyframes: videoKeyframes
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch video details" });
    }
  });

  // Tag management
  app.post('/api/videos/:id/tags', async (req, res) => {
    try {
      const { name, timestamp, confidence, aiGenerated } = req.body;
      const videoId = parseInt(req.params.id);

      const [tag] = await db.insert(tags).values({
        videoId,
        name,
        timestamp,
        confidence,
        aiGenerated
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
        videoId,
        timestamp,
        thumbnailUrl,
        metadata
      }).returning();

      res.json(keyframe);
    } catch (error) {
      res.status(500).json({ error: "Failed to create keyframe" });
    }
  });
}
