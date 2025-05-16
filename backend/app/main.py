import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import ResponseValidationError
from fastapi.responses import JSONResponse
# from pydantic import BaseModel, ValidationError
from app.routers.main import api_router

app = FastAPI(title='Video Content Hub API',
    description='API endpoints serving the Video Content Hub.')

@app.exception_handler(ResponseValidationError)
async def validation_exception_handler(request: Request, exc: ResponseValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

app.include_router(api_router)

# if __name__ == "__main__":
#     uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
