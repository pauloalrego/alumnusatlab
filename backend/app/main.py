import json
import logging
import os
import time
import traceback
from contextvars import ContextVar
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import event
from sqlalchemy.engine import Engine

from .database import engine, Base
from .routers import researchers, relationships, graph, upload, notes, auth, files, reminders, tips, deadlines, admin, groups, institutions, professors, users, profiles, milestones, readings, activity

# ── Logging estruturado (JSON em prod, texto legível em dev) ───────────────────

_ENV = os.getenv("APP_ENV", "development")

class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "severity": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
        })

def _setup_logging() -> None:
    fmt = _JsonFormatter() if _ENV == "production" else logging.Formatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s"
    )
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    if not root.handlers:
        h = logging.StreamHandler()
        h.setFormatter(fmt)
        root.addHandler(h)
    else:
        for h in root.handlers:
            h.setFormatter(fmt)

    # Uvicorn já configura seus próprios loggers — só ajusta o formatter
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        uv = logging.getLogger(name)
        for h in uv.handlers:
            h.setFormatter(fmt)

_setup_logging()
logger = logging.getLogger(__name__)

# ── Query counter por request ──────────────────────────────────────────────────
_query_counter: ContextVar[list] = ContextVar("query_counter", default=None)

@event.listens_for(Engine, "before_cursor_execute")
def _count_query(conn, cursor, statement, parameters, context, executemany):
    counter = _query_counter.get()
    if counter is not None:
        counter.append(1)

app = FastAPI(title="Alumnus API", version="0.1.0")

@app.middleware("http")
async def request_logger(request: Request, call_next):
    counter: list = []
    _query_counter.set(counter)
    t0 = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        ms = (time.perf_counter() - t0) * 1000
        logger.error(
            "Unhandled exception: %s %s (%.0f ms)\n%s",
            request.method, request.url.path, ms,
            traceback.format_exc(),
        )
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
    ms = (time.perf_counter() - t0) * 1000
    n = len(counter)
    level = logging.WARNING if response.status_code >= 400 else logging.INFO
    logger.log(
        level,
        "%-6s %-50s → %3d  %2d queries  (%.0f ms)",
        request.method, request.url.path, response.status_code, n, ms,
    )
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(researchers.router,   prefix="/api")
app.include_router(relationships.router, prefix="/api")
app.include_router(graph.router,         prefix="/api")
app.include_router(upload.router,        prefix="/api")
app.include_router(notes.router,         prefix="/api")
app.include_router(auth.router,          prefix="/api")
app.include_router(files.router,         prefix="/api")
app.include_router(reminders.router,     prefix="/api")
app.include_router(tips.router,          prefix="/api")
app.include_router(deadlines.router,     prefix="/api")
app.include_router(admin.router,        prefix="/api")
app.include_router(groups.router,       prefix="/api")
app.include_router(institutions.router, prefix="/api")
app.include_router(professors.router,  prefix="/api")
app.include_router(users.router,       prefix="/api")
app.include_router(profiles.router,    prefix="/api")
app.include_router(milestones.router,  prefix="/api")
app.include_router(readings.router,    prefix="/api")
app.include_router(activity.router,   prefix="/api")


@app.on_event("startup")
def on_startup():
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Alumnus API ready")


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve React frontend for all other routes (must be last)
FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    _screenshots_dir = FRONTEND_DIST / "screenshots"
    if _screenshots_dir.exists():
        app.mount("/screenshots", StaticFiles(directory=_screenshots_dir), name="screenshots")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        static_file = FRONTEND_DIST / full_path
        if static_file.is_file():
            return FileResponse(static_file)
        return FileResponse(FRONTEND_DIST / "index.html")
