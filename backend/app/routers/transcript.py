from typing import Any
from fastapi import APIRouter
from app.models import TranscriptPublic, JobStatus

router = APIRouter(prefix="/transcript", tags=["Transcript"])

COLLECTION_NAME = "transcripts"

# @router.post("/{source_id}", response_model=TranscriptPublic)
# def generate_transcript(source_id: str) -> Any:
#     """
#     Get transcript for a news source.
#     """
#     return TranscriptPublic(
#         source_id=source_id,
#         transcript=''
#     )

@router.get("/{source_id}", response_model=TranscriptPublic)
async def get_transcript(source_id: str) -> Any:
    """
    Get transcript by news source ID.
    """
    return TranscriptPublic(
        source_id=source_id,
        transcript='',
    )
