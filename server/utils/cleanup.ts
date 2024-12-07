import fs from "fs/promises";
import path from "path";
import { db } from "../../db";
import { videos } from "@db/schema";

export async function cleanupUnusedVideos() {
  try {
    // Get all videos from database
    const videoRecords = await db.query.videos.findMany();
    
    // Create Sets for active file paths, normalizing them for comparison
    const activeVideoPaths = new Set(
      videoRecords.map(v => v.url.replace(/^\/uploads\/videos\//, ''))
    );
    const activeThumbnailPaths = new Set(
      videoRecords
        .map(v => v.thumbnailUrl ? v.thumbnailUrl.replace(/^\/uploads\/thumbnails\//, '') : null)
        .filter(Boolean)
    );

    // Define directory paths
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const videosDir = path.join(uploadsDir, 'videos');
    const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
    const framesDir = path.join(uploadsDir, 'frames');

    // Create directories if they don't exist
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.mkdir(videosDir, { recursive: true });
    await fs.mkdir(thumbnailsDir, { recursive: true });
    await fs.mkdir(framesDir, { recursive: true });

    // Clean up video files
    try {
      const files = await fs.readdir(videosDir);
      for (const file of files) {
        try {
          const stats = await fs.stat(path.join(videosDir, file));
          if (stats.isFile() && !activeVideoPaths.has(file)) {
            console.log(`Removing unused video: ${file}`);
            await fs.unlink(path.join(videosDir, file));
          }
        } catch (error) {
          console.error(`Error processing video file ${file}:`, error);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error cleaning up videos directory:', error);
      }
    }

    // Clean up thumbnail files
    try {
      const files = await fs.readdir(thumbnailsDir);
      for (const file of files) {
        try {
          const stats = await fs.stat(path.join(thumbnailsDir, file));
          if (stats.isFile() && !activeThumbnailPaths.has(file)) {
            console.log(`Removing unused thumbnail: ${file}`);
            await fs.unlink(path.join(thumbnailsDir, file));
          }
        } catch (error) {
          console.error(`Error processing thumbnail file ${file}:`, error);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error cleaning up thumbnails directory:', error);
      }
    }

    // Clean up frames directory - remove any folders for non-existent video IDs
    try {
      const videoIds = new Set(videoRecords.map(v => v.id.toString()));
      const frameDirs = await fs.readdir(framesDir);
      for (const dir of frameDirs) {
        try {
          const stats = await fs.stat(path.join(framesDir, dir));
          if (stats.isDirectory() && !videoIds.has(dir)) {
            console.log(`Removing unused frames directory for video ID: ${dir}`);
            await fs.rm(path.join(framesDir, dir), { recursive: true, force: true });
          }
        } catch (error) {
          console.error(`Error processing frames directory ${dir}:`, error);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error cleaning up frames directory:', error);
      }
    }

    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}
