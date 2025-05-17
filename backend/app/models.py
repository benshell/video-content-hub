import os
from datetime import datetime, timezone
import uuid
from typing import List, Optional
from enum import Enum
from pydantic import BaseModel, Field, computed_field

GCS_BASE_URL = os.environ.get("GCS_BASE_URL", "https://storage.googleapis.com/video-content-hub-data")

# ---
# Enums
# ---

class JobStatus(str, Enum):
    """
    Represents the processing status of a job.
    """
    NOT_STARTED = "not_started"
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class AssetType(str, Enum):
    """
    Represents the type of asset
    """
    A_ROLL = "a_roll"
    B_ROLL = "b_roll"
    OUTPUT = "output"

class SourceType(str, Enum):
    """
    Represents the type of news source
    """
    VIDEO = "video"
    AUDIO = "audio"
    ARTICLE = "article"

class JobType(str, Enum):
    """
    Represents the type of background jobs that can be run
    """
    IMPORT_SOURCE = "import_source"
    TRANSCRIPT = "transcript"
    TEXT_INSIGHTS = "text_insights"
    IMAGE_INSIGHTS = "image_insights"        


# ---
# Generic Models
# ---
class Message(BaseModel):
    """Model for a generic message."""
    message: str

class Segment(BaseModel):
    start: float
    end: float


# ---
# Source Models
# ---

class SourceBase(BaseModel):
    """Base model for a news source item."""
    title: str = Field(min_length=1, max_length=255)
    url: Optional[str] = Field(default=None, max_length=255)
    source_type: str
    video: Optional[str] = Field(default=None, exclude=True)  # Internal file path, exclude from serialization
    created: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    import_status: JobStatus = Field(default=JobStatus.NOT_STARTED)
    transcript_status: JobStatus = Field(default=JobStatus.NOT_STARTED)
    text_insights_status: JobStatus = Field(default=JobStatus.NOT_STARTED)
    image_insights_status: JobStatus = Field(default=JobStatus.NOT_STARTED)

class SourceCreate(BaseModel):
    """Model for creating a new source."""
    title: str = Field(min_length=1, max_length=255)
    url: Optional[str] = Field(default=None, max_length=255)
    source_type: str

class SourceUpdate(SourceCreate):
    pass

class SourcePublic(SourceBase):
    """Public representation of a source."""
    source_id: str

    @computed_field
    def video_url(self) -> Optional[str]:
        return f"{GCS_BASE_URL}/{self.video}" if self.video else None


# ---
# Insight Models
# ---

class InsightBase(BaseModel):
    """
    Base model for a single insight, including fields that might be processed asynchronously.
    """
    insight_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True) # Each insight has its own ID
    story_id: uuid.UUID = Field(index=True) # Link back to the story

    theme: str = Field(min_length=1, max_length=255)
    context_summary: str = Field(default=None, max_length=2048)
    related_segments: List[Segment] = []
    
    # Image summary - longer processing, will be populated later
    image_summary: Optional[str] = Field(default=None, max_length=2048)
    image_summary_status: JobStatus = Field(default=JobStatus.NOT_STARTED)
    # image_summary_generated_at: Optional[datetime] = Field(default=None)

class InsightPublic(InsightBase):
    """
    Public representation of a single insight.
    Includes both the text-based elements and the status of the image summary.
    """
    # Inherits all fields from InsightBase

class InsightsPublic(BaseModel):
    """Public representation of an array of insights."""
    data: list[InsightPublic]


# ---
# Asset Models
# ---

class AssetBase(BaseModel):
    """Base model for a file asset."""
    # asset_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True) # Each insight has its own ID
    story_id: uuid.UUID = Field(index=True) # Link back to the story
    filename: str = Field(min_length=1, max_length=255)
    filepath: str | None = Field(default=None, max_length=255)
    asset_type: AssetType = Field()

class AssetPublic(AssetBase):
    """Public representation of an asset."""

class AssetsPublic(BaseModel):
    """Public representation of an array of assets."""
    main_footage: AssetPublic
    b_roll: list[AssetPublic]


# ---
# Story Models
# ---

class StoryBase(BaseModel):
    """Base model for a story."""
    story_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default='', max_length=255)
    script: Optional[str] = Field(default='')

class StoryPublic(StoryBase):
    """
    Public representation of a story, including its associated insights list, assets, etc.
    This is what the UI will poll.
    """

class StoriesPublic(BaseModel):
    """Public representation of an array of stories."""
    data: list[StoryPublic]


# ---
# Transcript Models
# ---

class TranscriptBase(BaseModel):
    """Base model for a story."""
    source_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    transcript: Optional[str]

class TranscriptPublic(TranscriptBase):
    """
    Public representation of a transcript.
    """


# ---
# Export Models
# ---

class ExportBase(BaseModel):
    """Base model for an export."""
    story_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    public_url: str

class ExportPublic(ExportBase):
    """
    Public representation of a transcript.
    """
