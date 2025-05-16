from datetime import datetime
import uuid
from typing import List, Optional
from enum import Enum # New: for status enum
from sqlmodel import Field, SQLModel

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

# ---
# Generic Models
# ---
class Message(SQLModel):
    """Model for a generic message."""
    message: str

class Segment(SQLModel):
    start: float
    end: float


# ---
# Insight Models
# ---

class InsightBase(SQLModel):
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

class InsightsPublic(SQLModel):
    """Public representation of an array of insights."""
    data: list[InsightPublic]


# ---
# Asset Models
# ---

class AssetBase(SQLModel):
    """Base model for a file asset."""
    # asset_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True) # Each insight has its own ID
    story_id: uuid.UUID = Field(index=True) # Link back to the story
    filename: str = Field(min_length=1, max_length=255)
    filepath: str | None = Field(default=None, max_length=255)
    asset_type: AssetType = Field()

class AssetPublic(AssetBase):
    """Public representation of an asset."""

class AssetsPublic(SQLModel):
    """Public representation of an array of assets."""
    main_footage: AssetPublic
    b_roll: list[AssetPublic]


# ---
# Story Models
# ---

class StoryBase(SQLModel):
    """Base model for a story."""
    story_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(default='', max_length=255)
    script: Optional[str] = Field(default='')
    asset_status: JobStatus = Field(default=JobStatus.NOT_STARTED)
    transcript_status: JobStatus = Field(default=JobStatus.NOT_STARTED)
    text_insights_status: JobStatus = Field(default=JobStatus.NOT_STARTED)
    image_insights_status: JobStatus = Field(default=JobStatus.NOT_STARTED)

class StoryPublic(StoryBase):
    """
    Public representation of a story, including its associated insights list, assets, etc.
    This is what the UI will poll.
    """

class StoriesPublic(SQLModel):
    """Public representation of an array of stories."""
    data: list[StoryPublic]


# ---
# Transcript Models
# ---

class TranscriptBase(SQLModel):
    """Base model for a story."""
    story_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    transcript: Optional[str]

class TranscriptPublic(TranscriptBase):
    """
    Public representation of a transcript.
    """


# ---
# Export Models
# ---

class ExportBase(SQLModel):
    """Base model for an export."""
    story_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    public_url: str

class ExportPublic(ExportBase):
    """
    Public representation of a transcript.
    """
