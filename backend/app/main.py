from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.logging import logger
from app.core.exceptions import RAGMindException
from app.api.routes import (
    health, documents, collections, conversations, chat, settings as settings_routes, diagnostics
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="RAGMind — AI Knowledge Engine API. Production RAG document intelligence platform.",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Centralized custom exception handler
@app.exception_handler(RAGMindException)
async def ragmind_exception_handler(request: Request, exc: RAGMindException):
    logger.warning(f"Handled application exception on {request.url.path}: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "type": exc.__class__.__name__}
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected internal server error occurred.", "error": str(exc)}
    )

# Include Routers
app.include_router(health.router, prefix=settings.API_V1_STR)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(collections.router, prefix=settings.API_V1_STR)
app.include_router(conversations.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(settings_routes.router, prefix=settings.API_V1_STR)
app.include_router(diagnostics.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "message": "Welcome to RAGMind — AI Knowledge Engine API. Access /docs for OpenAPI specs."
    }

logger.info(f"RAGMind API v{settings.VERSION} initialized successfully.")
