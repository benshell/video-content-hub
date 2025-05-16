from typing import Tuple
import os
import subprocess
from app.utils import create_folder
from yt_dlp import YoutubeDL

def download_from_youtube(video_id: str, subfolder: str) -> Tuple[str, str, str]:
    folder = create_folder(subfolder)
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    
     # Output filenames
    combined_file = f"{folder}/{video_id}.mp4"
    audio_file = f"{folder}/{video_id}.audio.m4a"
    video_file = f"{folder}/{video_id}.video.mp4"
    
    # Step 1: Download combined audio+video with yt_dlp
    ydl_opts = {
        'format': 'bestvideo+bestaudio/best',
        'outtmpl': combined_file,
        'merge_output_format': 'mp4',
        'progress_hooks': [lambda d: print(f"Downloaded combined: {combined_file}") if d['status'] == 'finished' else None],
    }

    with YoutubeDL(ydl_opts) as ydl:
        ydl.download([video_url])

    # Verify combined file exists
    if not os.path.exists(combined_file):
        raise FileNotFoundError(f"Failed to download combined file: {combined_file}")
    
    # Step 2: Extract audio using ffmpeg
    try:
        cmd = ['ffmpeg', '-y', '-i', combined_file, '-acodec', 'aac', '-vn', audio_file]
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"Extracted audio: {audio_file}")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Failed to extract audio: {e.stderr}")

    # Step 3: Extract video (without audio) using ffmpeg
    try:
        cmd = ['ffmpeg', '-y', '-i', combined_file, '-vcodec', 'copy', '-an', video_file]
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print(f"Extracted video: {video_file}")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Failed to extract video: {e.stderr}")

    # Verify extracted files exist
    if not os.path.exists(audio_file) or not os.path.exists(video_file):
        raise FileNotFoundError("Failed to extract audio or video file.")

    return combined_file, audio_file, video_file