import os
import uuid
from typing import Any
from fastapi import APIRouter, status
from app.models import ExportPublic

router = APIRouter(prefix="/export", tags=["Export"])

@router.post("/{story_id}", response_model=ExportPublic, status_code=status.HTTP_201_CREATED)
def export_video(story_id: str, aspect_ratio: str = '16:9', audio_only: bool = False) -> Any:
    """
    Create video export.
    """
    return ExportPublic(
        story_id=story_id,
        public_url=''
    )
