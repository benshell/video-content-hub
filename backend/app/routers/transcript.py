from typing import Any
from fastapi import APIRouter
from app.models import TranscriptPublic

router = APIRouter(prefix="/transcript", tags=["Transcript"])

@router.get("/{story_id}", response_model=TranscriptPublic)
def get_transcript(story_id: str) -> Any:
    """
    Get transcript by ID.
    """
    return TranscriptPublic(
        story_id=story_id,
        transcript=''
    )
