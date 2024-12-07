import { Video, Tag, Keyframe } from "@db/schema";

interface UploadProgressCallback {
  (progress: number): void;
}

interface UploadVideoParams {
  formData: FormData;
  onProgress?: UploadProgressCallback;
}

export async function uploadVideo({ formData, onProgress }: UploadVideoParams): Promise<Video> {
  const xhr = new XMLHttpRequest();
  
  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.response));
      } else {
        reject(new Error('Upload failed'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));

    xhr.open('POST', '/api/videos');
    xhr.send(formData);
  });
}

export async function fetchVideos(): Promise<Video[]> {
  const response = await fetch('/api/videos');
  if (!response.ok) {
    throw new Error('Failed to fetch videos');
  }
  return response.json();
}

export async function fetchVideoDetails(id: number): Promise<Video & { tags: Tag[], keyframes: Keyframe[] }> {
  const response = await fetch(`/api/videos/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch video details');
  }
  return response.json();
}

export async function createTag(tag: Omit<Tag, 'id'>): Promise<Tag> {
  const response = await fetch(`/api/videos/${tag.videoId}/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tag),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create tag');
  }
  return response.json();
}

export async function createKeyframe(keyframe: Omit<Keyframe, 'id'>): Promise<Keyframe> {
  const response = await fetch(`/api/videos/${keyframe.videoId}/keyframes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(keyframe),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create keyframe');
  }
  return response.json();
}

export async function exportVideoData(id: number): Promise<any> {
  const response = await fetch(`/api/videos/${id}/export`);
  if (!response.ok) {
    throw new Error('Failed to export video data');
  }
  return response.json();
}
export async function deleteVideo(id: number): Promise<void> {
  const response = await fetch(`/api/videos/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete video');
  }
}
