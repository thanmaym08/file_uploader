"""
QuickDrop Pro — Backend API
FastAPI + MongoDB Atlas + GridFS
Lossless HD file sharing with bundle support, WebSocket pulse, and 24h TTL.
"""

import os
import uuid
import hashlib
import zipfile
from io import BytesIO
from datetime import datetime, timezone
from typing import Optional, List, Dict

from fastapi import (
    FastAPI, UploadFile, File, Form, Query,
    HTTPException, WebSocket, WebSocketDisconnect,
    BackgroundTasks,
)
from fastapi.responses import StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId
import bcrypt
import certifi
from dotenv import load_dotenv

load_dotenv()

# ──────────────────────────────────────────────
# App Init
# ──────────────────────────────────────────────
app = FastAPI(
    title="QuickDrop Pro",
    description="Lossless HD ephemeral file sharing with bundle support",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# MongoDB + GridFS
# ──────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/quickdrop")

mongo_client: AsyncIOMotorClient = None
db = None
bundles_col = None
fs_bucket: AsyncIOMotorGridFSBucket = None


@app.on_event("startup")
async def startup_db():
    global mongo_client, db, bundles_col, fs_bucket
    mongo_client = AsyncIOMotorClient(MONGO_URI, tlsCAFile=certifi.where())
    db = mongo_client.quickdrop
    bundles_col = db.bundles
    fs_bucket = AsyncIOMotorGridFSBucket(db)

    # TTL index — auto-delete bundle docs 24 hours after creation
    await bundles_col.create_index("created_at", expireAfterSeconds=86400)
    print("[OK] MongoDB connected - TTL index ready")


@app.on_event("shutdown")
async def shutdown_db():
    if mongo_client:
        mongo_client.close()


# ──────────────────────────────────────────────
# WebSocket — Live Download Pulse
# ──────────────────────────────────────────────
class PulseManager:
    """Manages WebSocket connections per bundle for real-time download notifications."""

    def __init__(self):
        self._conns: Dict[str, List[WebSocket]] = {}

    async def connect(self, ws: WebSocket, bundle_id: str):
        await ws.accept()
        self._conns.setdefault(bundle_id, []).append(ws)

    def disconnect(self, ws: WebSocket, bundle_id: str):
        if bundle_id in self._conns:
            self._conns[bundle_id] = [
                c for c in self._conns[bundle_id] if c is not ws
            ]
            if not self._conns[bundle_id]:
                del self._conns[bundle_id]

    async def pulse(self, bundle_id: str, event: dict):
        """Send a pulse event to all listeners on a bundle."""
        if bundle_id not in self._conns:
            return
        dead = []
        for ws in self._conns[bundle_id]:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, bundle_id)


pulse_mgr = PulseManager()


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
async def _burn_bundle(bundle_id: str, files: list):
    """Delete all GridFS files and the bundle document."""
    for f in files:
        try:
            await fs_bucket.delete(ObjectId(f["grid_id"]))
        except Exception:
            pass
    await bundles_col.delete_one({"_id": bundle_id})


def _now():
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────
# POST /drop/upload — Bundle Upload (multi-file)
# ──────────────────────────────────────────────
@app.post("/drop/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    password: Optional[str] = Form(None),
    burn_on_read: bool = Form(False),
):
    """
    Upload one or more files as a single bundle.
    Returns a bundle_id accessible via one QR code / link.
    Files are stored bit-for-bit in GridFS (lossless HD pipeline).
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    bundle_id = str(uuid.uuid4())

    # Optional password hashing
    pwd_hash = ""
    if password:
        pwd_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    file_records = []
    total_bytes = 0

    for f in files:
        # Read raw bytes — zero processing, zero compression
        raw = await f.read()
        size = len(raw)
        total_bytes += size

        # SHA-256 checksum for lossless integrity verification
        sha256 = hashlib.sha256(raw).hexdigest()

        # Store in GridFS (raw binary, application/octet-stream to bypass any codec)
        grid_id = await fs_bucket.upload_from_stream(
            f.filename,
            BytesIO(raw),
            metadata={
                "bundle_id": bundle_id,
                "original_content_type": f.content_type,
                "sha256": sha256,
            },
        )

        file_records.append({
            "grid_id": str(grid_id),
            "filename": f.filename,
            "mime_type": f.content_type or "application/octet-stream",
            "size_bytes": size,
            "sha256": sha256,
        })

    # Bundle document in MongoDB
    bundle_doc = {
        "_id": bundle_id,
        "files": file_records,
        "password_hash": pwd_hash,
        "burn_on_read": burn_on_read,
        "download_count": 0,
        "total_bytes": total_bytes,
        "created_at": _now(),
    }
    await bundles_col.insert_one(bundle_doc)

    return {
        "bundle_id": bundle_id,
        "file_count": len(file_records),
        "total_bytes": total_bytes,
        "files": [
            {"filename": r["filename"], "size_bytes": r["size_bytes"], "sha256": r["sha256"]}
            for r in file_records
        ],
        "message": "Upload successful",
    }


# ──────────────────────────────────────────────
# GET /drop/bundle/{bundle_id} — Bundle Metadata
# ──────────────────────────────────────────────
@app.get("/drop/bundle/{bundle_id}")
async def get_bundle_info(bundle_id: str):
    """Return metadata for a bundle (file list, sizes, protection status)."""
    bundle = await bundles_col.find_one({"_id": bundle_id})
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found or expired")

    # Send scan pulse to uploader
    await pulse_mgr.pulse(bundle_id, {
        "event": "pulse",
        "type": "scan",
        "timestamp": _now().isoformat(),
    })

    return {
        "bundle_id": bundle_id,
        "file_count": len(bundle["files"]),
        "total_bytes": bundle.get("total_bytes", 0),
        "files": [
            {
                "index": i,
                "filename": f["filename"],
                "mime_type": f["mime_type"],
                "size_bytes": f["size_bytes"],
            }
            for i, f in enumerate(bundle["files"])
        ],
        "password_protected": bool(bundle.get("password_hash")),
        "burn_on_read": bundle.get("burn_on_read", False),
        "download_count": bundle.get("download_count", 0),
        "created_at": bundle["created_at"].isoformat(),
    }


# ──────────────────────────────────────────────
# POST /drop/verify-password/{bundle_id}
# ──────────────────────────────────────────────
@app.post("/drop/verify-password/{bundle_id}")
async def verify_bundle_password(bundle_id: str, password: str = Form(...)):
    """Verify password for a protected bundle. Returns 200 if correct."""
    bundle = await bundles_col.find_one({"_id": bundle_id})
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found or expired")

    if not bundle.get("password_hash"):
        return {"valid": True, "message": "No password required"}

    if bcrypt.checkpw(password.encode("utf-8"), bundle["password_hash"].encode("utf-8")):
        return {"valid": True, "message": "Password correct"}
    else:
        raise HTTPException(status_code=403, detail="Invalid password")


# ──────────────────────────────────────────────
# GET /drop/download/{bundle_id}/{file_index}
#   — Download Individual File (Lossless HD)
# ──────────────────────────────────────────────
@app.get("/drop/download/{bundle_id}/{file_index}")
async def download_file(
    bundle_id: str,
    file_index: int,
    password: Optional[str] = Query(None),
    background_tasks: BackgroundTasks = None,
):
    """
    Download a single file from a bundle.
    Serves raw, uncompressed bytes with SHA-256 checksum header.
    """
    bundle = await bundles_col.find_one({"_id": bundle_id})
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found or expired")

    # Password gate
    if bundle.get("password_hash"):
        if not password:
            raise HTTPException(status_code=401, detail="Password required")
        if not bcrypt.checkpw(
            password.encode("utf-8"),
            bundle["password_hash"].encode("utf-8"),
        ):
            raise HTTPException(status_code=403, detail="Invalid password")

    if file_index < 0 or file_index >= len(bundle["files"]):
        raise HTTPException(status_code=404, detail="File index out of range")

    file_meta = bundle["files"][file_index]
    grid_id = ObjectId(file_meta["grid_id"])

    # Pulse: download started
    await pulse_mgr.pulse(bundle_id, {
        "event": "pulse",
        "type": "download_start",
        "file_index": file_index,
        "filename": file_meta["filename"],
        "timestamp": _now().isoformat(),
    })

    # Stream from GridFS — raw bytes, no re-encoding
    grid_out = await fs_bucket.open_download_stream(grid_id)
    content = await grid_out.read()

    # Pulse: download complete
    await pulse_mgr.pulse(bundle_id, {
        "event": "pulse",
        "type": "download_complete",
        "file_index": file_index,
        "filename": file_meta["filename"],
        "timestamp": _now().isoformat(),
    })

    # Increment download count
    await bundles_col.update_one(
        {"_id": bundle_id},
        {"$inc": {"download_count": 1}},
    )

    # Burn on read
    if bundle.get("burn_on_read"):
        background_tasks.add_task(_burn_bundle, bundle_id, bundle["files"])

    # Lossless headers — no compression, checksum for verification
    headers = {
        "Content-Disposition": f'attachment; filename="{file_meta["filename"]}"',
        "X-Checksum-SHA256": file_meta["sha256"],
        "Content-Encoding": "identity",
        "Cache-Control": "no-store",
        "Content-Length": str(file_meta["size_bytes"]),
    }

    return Response(
        content=content,
        media_type="application/octet-stream",
        headers=headers,
    )


# ──────────────────────────────────────────────
# GET /drop/download/{bundle_id}
#   — Download All Files as ZIP (Lossless)
# ──────────────────────────────────────────────
@app.get("/drop/download-all/{bundle_id}")
async def download_bundle_zip(
    bundle_id: str,
    password: Optional[str] = Query(None),
    background_tasks: BackgroundTasks = None,
):
    """
    Download all files in a bundle as a ZIP archive.
    Uses ZIP_STORED (no compression) to maintain lossless integrity.
    """
    bundle = await bundles_col.find_one({"_id": bundle_id})
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found or expired")

    # Password gate
    if bundle.get("password_hash"):
        if not password:
            raise HTTPException(status_code=401, detail="Password required")
        if not bcrypt.checkpw(
            password.encode("utf-8"),
            bundle["password_hash"].encode("utf-8"),
        ):
            raise HTTPException(status_code=403, detail="Invalid password")

    # Pulse: download all started
    await pulse_mgr.pulse(bundle_id, {
        "event": "pulse",
        "type": "download_all_start",
        "timestamp": _now().isoformat(),
    })

    # Read all files from GridFS first
    file_contents = []
    for file_meta in bundle["files"]:
        grid_id = ObjectId(file_meta["grid_id"])
        grid_out = await fs_bucket.open_download_stream(grid_id)
        raw = await grid_out.read()
        file_contents.append((file_meta["filename"], raw))

    # Build ZIP in memory — ZIP_STORED = no compression = lossless
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_STORED) as zf:
        for filename, content in file_contents:
            zf.writestr(filename, content)
    zip_buffer.seek(0)

    # Pulse: download all complete
    await pulse_mgr.pulse(bundle_id, {
        "event": "pulse",
        "type": "download_all_complete",
        "timestamp": _now().isoformat(),
    })

    # Increment download count
    await bundles_col.update_one(
        {"_id": bundle_id},
        {"$inc": {"download_count": 1}},
    )

    # Burn on read
    if bundle.get("burn_on_read"):
        background_tasks.add_task(_burn_bundle, bundle_id, bundle["files"])

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="quickdrop-{bundle_id[:8]}.zip"',
            "Cache-Control": "no-store",
        },
    )


# ──────────────────────────────────────────────
# WebSocket /ws/bundle/{bundle_id}
# ──────────────────────────────────────────────
@app.websocket("/ws/bundle/{bundle_id}")
async def ws_bundle_pulse(websocket: WebSocket, bundle_id: str):
    """
    Uploader connects here after uploading a bundle.
    Receives real-time pulse events when someone scans/downloads.
    """
    await pulse_mgr.connect(websocket, bundle_id)
    try:
        while True:
            # Keep alive — client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        pulse_mgr.disconnect(websocket, bundle_id)


# ──────────────────────────────────────────────
# Health Check
# ──────────────────────────────────────────────
@app.get("/health")
async def health():
    try:
        await mongo_client.admin.command("ping")
        return {"status": "healthy", "mongodb": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "mongodb": str(e)}


# ──────────────────────────────────────────────
# Run
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
