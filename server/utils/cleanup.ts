import fs from "fs/promises";
import path from "path";
import { db } from "../../db";
import { videos } from "@db/schema";

export async function cleanupUnusedVideos() {
  try {
    // Get all videos from database
    const videoRecords = await db.query.videos.findMany();
    const activeVideoPaths = new Set(videoRecords.map(v => path.join(process.cwd(), v.url)));
    const activeThumbnailPaths = new Set(videoRecords.map(v => v.thumbnailUrl ? path.join(process.cwd(), v.thumbnailUrl) : null).filter(Boolean));

    // Get all files in uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const videosDir = path.join(uploadsDir, 'videos');
    const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
    const framesDir = path.join(uploadsDir, 'frames');

    // Clean up video files
    try {
      const files = await fs.readdir(videosDir);
      for (const file of files) {
        const filePath = path.join(videosDir, file);
        if (!activeVideoPaths.has(filePath)) {
          console.log(`Removing unused video: ${file}`);
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning up videos directory:', error);
    }

    // Clean up thumbnail files
    try {
      const files = await fs.readdir(thumbnailsDir);
      for (const file of files) {
        const filePath = path.join(thumbnailsDir, file);
        if (!activeThumbnailPaths.has(filePath)) {
          console.log(`Removing unused thumbnail: ${file}`);
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning up thumbnails directory:', error);
    }

    // Clean up frames directory - remove any folders for non-existent video IDs
    try {
      const videoIds = new Set(videoRecords.map(v => v.id.toString()));
      const frameDirs = await fs.readdir(framesDir);
      for (const dir of frameDirs) {
        if (!videoIds.has(dir)) {
          console.log(`Removing unused frames directory for video ID: ${dir}`);
          await fs.rm(path.join(framesDir, dir), { recursive: true, force: true });
        }
      }
    } catch (error) {
      console.error('Error cleaning up frames directory:', error);
    }

    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}
