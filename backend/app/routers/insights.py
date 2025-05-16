import os
from typing import Any
from fastapi import APIRouter
from app.models import InsightsPublic

DATA_HOME = os.getenv("DATA_HOME", "data")

router = APIRouter(prefix="/insights", tags=["Insights"])

@router.get("/{story_id}", response_model=InsightsPublic)
def get_story_insights(story_id: str) -> Any:
    return InsightsPublic(data=[])
