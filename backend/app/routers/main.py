import uvicorn
from fastapi import APIRouter

from app.routers import stories, insights, assets, transcript, export

api_router = APIRouter()
api_router.include_router(stories.router)
api_router.include_router(insights.router)
api_router.include_router(assets.router)
api_router.include_router(transcript.router)
api_router.include_router(export.router)

@api_router.get("/", tags=["Health Check"])
def read_root():
    return "Video Content Hub API. Visit /docs to view the schema."
