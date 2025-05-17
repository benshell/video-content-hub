import os
import uuid
from typing import Dict, Any
from app.youtube import download_from_youtube
from fastapi import APIRouter, status, HTTPException
from google.cloud import firestore
from app.utils import create_folder, get_all_files_in_folder, get_youtube_id
from app.models import JobStatus, JobType, SourceCreate, SourceUpdate, SourcePublic, Message

router = APIRouter(prefix="/sources", tags=["Sources"])
db = firestore.Client()

COLLECTION_NAME = "sources"

@router.get("/", response_model=list[SourcePublic])
async def read_all_sources() -> Any:
    """
    Retrieve a list of news sources.
    """
    sources = []
    docs = db.collection(COLLECTION_NAME).stream()
    for doc in docs:
        sources.append(SourcePublic(source_id=doc.id, **doc.to_dict()))
    return sources

@router.get("/{source_id}", response_model=SourcePublic)
async def get_source(source_id: str) -> Any:
    """
    Get a news source by ID.
    """
    doc = db.collection(COLLECTION_NAME).document(source_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Source not found")
    return SourcePublic(source_id=doc.id, **doc.to_dict())

@router.post("/", response_model=SourcePublic, status_code=status.HTTP_201_CREATED)
async def create_source(source_in: SourceCreate) -> Any:
    """
    Create a news source.
    """
    source_id = str(uuid.uuid4())
    source_data = source_in.model_dump()
    source_data["created"] = firestore.SERVER_TIMESTAMP
    db.collection(COLLECTION_NAME).document(source_id).set(source_data)
    created_doc = db.collection(COLLECTION_NAME).document(source_id).get()
    return SourcePublic(source_id=created_doc.id, **created_doc.to_dict())

@router.put("/{source_id}", response_model=SourcePublic)
async def update_source(source_id: str, source_in: SourceUpdate) -> Any:
    """
    Update an existing news source.
    """
    doc_ref = db.collection(COLLECTION_NAME).document(source_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Source not found")
    update_data = source_in.model_dump(exclude_unset=True)
    doc_ref.update(update_data)
    updated_doc = doc_ref.get()
    return SourcePublic(source_id=updated_doc.id, **updated_doc.to_dict())

@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(source_id: str):
    """
    Delete a news source by ID.
    """
    doc_ref = db.collection(COLLECTION_NAME).document(source_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Source not found")
    doc_ref.delete()
    return

@router.patch("/{source_id}/process", status_code=status.HTTP_204_NO_CONTENT)
async def background_job_processor(source_id: str, job: JobType):
    """
    Process the source: eventually this should be run as a background job.
    """
    doc_ref = db.collection(COLLECTION_NAME).document(source_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Source not found")
    source = SourcePublic(source_id=doc.id, **doc.to_dict())
    if job == JobType.IMPORT_SOURCE:
        video_id = get_youtube_id(source.url)
        if not video_id:
            raise HTTPException(status_code=422, detail=f"Unrecognized URL. Currently the import only support YouTube. {source.url}")
        # Download the YouTube video
        combined_file, audio_file, video_file = download_from_youtube(video_id, f"sources/{source.source_id}")
        update_data = {
            "video": combined_file,
        }
        doc_ref.update(update_data)
    elif job == JobType.TRANSCRIPT:
        if source.import_status != JobStatus.COMPLETED:
            raise HTTPException(status_code=422, detail=f"Unable to run job before source import is complete: {source.import_status}")
        print('TRANSCRIPT')
    elif job == JobType.TEXT_INSIGHTS:
        if source.import_status != JobStatus.COMPLETED:
            raise HTTPException(status_code=422, detail=f"Unable to run job before source import is complete: {source.import_status}")
        print('TEXT_INSIGHTS')
    elif job == JobType.IMAGE_INSIGHTS:
        if source.import_status != JobStatus.COMPLETED:
            raise HTTPException(status_code=422, detail=f"Unable to run job before source import is complete: {source.import_status}")
        print('IMAGE_INSIGHTS')
    else:
        raise HTTPException(status_code=422, detail="Unknown job type")
    return
    