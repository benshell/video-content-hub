from http.client import HTTPException
import os
import uuid
from typing import Dict, Any
from fastapi import APIRouter, status
from google.cloud import firestore
from app.models import SourceCreate, SourceType, SourceUpdate, SourcesPublic, SourcePublic, Message

router = APIRouter(prefix="/sources", tags=["Sources"])
db = firestore.Client()

COLLECTION_NAME = "sources"  # Define your collection name

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

# async def create_source(title: str, url: str, source_type: SourceType) -> Any:
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
