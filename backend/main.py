"""
Smart Patient Triage — FastAPI Application
---------------------------------------------
Brings together the AI engine, services, and API routes into a
single ASGI application with CORS, structured logging,
and automatic OpenAPI docs.
"""

import os
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import router as triage_router


# ── Structured Logging ────────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("vigil")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — preload the ML model so first request isn't slow
    from backend.ai_engine import predictor
    predictor._load()
    logger.info("ML model loaded and ready — Vigil is operational")
    yield
    # Shutdown
    logger.info("Vigil shutting down gracefully")


ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "*",                         # allow all origins by default for hackathon
).split(",")

app = FastAPI(
    title="Vigil — Smart Patient Triage System",
    description=(
        "AI‑powered patient risk classification, department recommendation, "
        "explainability, digital twin simulation, and resource‑aware triage."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — configurable via env
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request Logging Middleware ────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s → %s (%.1fms)",
        request.method, request.url.path, response.status_code, elapsed,
    )
    return response


# Mount REST routes
app.include_router(triage_router, prefix="/api")


# ── Health check ──────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "Vigil",
        "version": "1.0.0",
    }
