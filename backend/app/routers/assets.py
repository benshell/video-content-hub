import os
from typing import Any
from fastapi import APIRouter, UploadFile
from app.youtube import download_from_youtube
from app.models import AssetPublic, AssetType, Message
from app.utils import create_folder

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.post("/upload")
def upload_asset(story_id: str, asset_type: AssetType, file: UploadFile) -> Any:
    try:
        folder = create_folder(story_id)
        file_path = os.path.join(folder, file.filename)
        with open(file_path, "wb") as buffer:
            buffer.write(file.file.read())  # file.file is a SpooledTemporaryFile

        return AssetPublic(
            story_id=story_id,
            filename=file.filename,
            filepath=file_path,
            asset_type=asset_type # TODO: Store the asset type somewhere (DB?)
        )
    except Exception as e:
        return Message(e)


@router.post("/add_youtube_video")
def add_youtube_video(story_id: str, asset_type: AssetType, video_id: str) -> Any:
    try:
        combined_file, audio_file, video_file = download_from_youtube(video_id, story_id)
        return AssetPublic(
            story_id=story_id,
            filename=os.path.basename(combined_file),
            filepath=combined_file,
            asset_type=asset_type # TODO: Store the asset type somewhere (DB?)
        )
    except Exception as e:
        return Message(e)
