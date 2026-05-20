from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import logging
import os
from datetime import datetime

from app.config import settings
from app.routers import tasks, credits, agent


# 日志目录可通过环境变量RSHUB_AGENT_LOG_DIR或settings.LOG_DIR配置，默认'logs'
log_dir = os.getenv('RSHUB_AGENT_LOG_DIR', getattr(settings, 'LOG_DIR', 'logs'))
os.makedirs(log_dir, exist_ok=True)
# 日志文件名带时间戳，启动即新文件
log_filename = f"rshub_agent_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
log_path = os.path.join(log_dir, log_filename)


# 配置日志：同时输出到文件和控制台
log_level = getattr(logging, settings.LOG_LEVEL)
log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

file_handler = logging.FileHandler(log_path, mode='w', encoding='utf-8')
file_handler.setLevel(log_level)
file_handler.setFormatter(logging.Formatter(log_format))

console_handler = logging.StreamHandler()
console_handler.setLevel(log_level)
console_handler.setFormatter(logging.Formatter(log_format))

logging.basicConfig(level=log_level, handlers=[file_handler, console_handler])
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="RSHub Agent Backend",
    description="Lightweight backend for RSHub web application",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Configure CORS
cors_kwargs = {
    "allow_origins": settings.cors_origins_list if settings.cors_origins_list else [],
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
    "max_age": 86400,  # cache preflight for a day
}
if settings.cors_origin_regex:
    cors_kwargs["allow_origin_regex"] = settings.cors_origin_regex

app.add_middleware(CORSMiddleware, **cors_kwargs)

@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    """
    Explicit handler for CORS preflight OPTIONS requests.
    Bypasses potential middleware issues in production environment.
    """
    return JSONResponse(
        status_code=200,
        content={},
        headers={
            "Access-Control-Allow-Origin": "https://rshub.zju.edu.cn",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400",
        },
    )

# Include routers
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(credits.router, prefix="/api/credits", tags=["Credits"])
app.include_router(agent.router, prefix="/api/agent", tags=["Agent"])

# Mount static files for plot images
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "RSHub Agent Backend API",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unified error responses"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred"
            }
        }
    )

