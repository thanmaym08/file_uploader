# QuickDrop Pro — Storage Architecture

> **v2.0** — Migrated from Redis to MongoDB Atlas + GridFS. Redis is no longer required.

## Primary Store: MongoDB Atlas

### Database: `quickdrop`

---

### Collection: `bundles`

Stores metadata for each uploaded bundle (one or more files grouped together).

- **`_id`** (String — UUID4): The bundle identifier, used in share links and QR codes.
- **`files`** (Array of Objects): List of files in this bundle.
  - `grid_id` (String — ObjectId ref): Reference to the GridFS file.
  - `filename` (String): Original filename (e.g., `photo.jpg`).
  - `mime_type` (String): MIME type (e.g., `image/jpeg`).
  - `size_bytes` (Integer): File size in bytes.
  - `sha256` (String): SHA-256 checksum for lossless integrity verification.
- **`password_hash`** (String): bcrypt hash if password-protected, empty string otherwise.
- **`burn_on_read`** (Boolean): If `true`, bundle self-destructs after first download.
- **`download_count`** (Integer): Number of times any file in this bundle has been downloaded.
- **`total_bytes`** (Integer): Sum of all file sizes.
- **`created_at`** (ISODate): Timestamp of upload, used by TTL index.

### TTL Index

```javascript
db.bundles.createIndex({ "created_at": 1 }, { expireAfterSeconds: 86400 })
```

MongoDB automatically deletes the bundle document 24 hours after `created_at`. 

> **Note**: The TTL index only deletes the *document*. GridFS file chunks (`fs.files` + `fs.chunks`) are orphaned and cleaned up by a background task or periodic sweep. In production, a scheduled job should call `fs.delete()` for orphaned GridFS entries.

---

### GridFS: `fs.files` + `fs.chunks`

Stores raw, uncompressed file bytes. Each file uploaded via a bundle is stored as a GridFS entry.

- **Bucket**: Default (`fs`)
- **Chunk size**: 255KB (MongoDB default)
- **Metadata per file**:
  - `bundle_id` (String): Back-reference to the parent bundle.
  - `original_content_type` (String): The file's original MIME type.
  - `sha256` (String): Integrity checksum.

Files are stored as raw binary (`application/octet-stream`). No image processing, no compression, no re-encoding — bit-for-bit fidelity.

---

## WebSocket State

Managed in-memory by the `PulseManager` class (no external service required).

- `Dict[bundle_id, List[WebSocket]]` — maps bundle IDs to connected uploaders.
- Pulse events are sent when recipients scan QR, start download, or complete download.
- State is ephemeral — lost on server restart (acceptable for real-time notifications).

---

## Operations Flow

### Upload
1. Generate `bundle_id` (UUID4).
2. For each file: compute SHA-256, upload raw bytes to GridFS, collect `grid_id`.
3. Insert bundle document with file records + `created_at` timestamp.
4. TTL index ensures auto-deletion after 24 hours.

### Download (Recipient)
1. `GET /drop/bundle/{bundle_id}` — fetch metadata, trigger "scan" pulse.
2. `GET /drop/download/{bundle_id}/{file_index}?password=...` — download individual file.
3. `GET /drop/download-all/{bundle_id}?password=...` — download all as ZIP (ZIP_STORED, no compression).
4. Pulse events notify the uploader in real-time.
5. If `burn_on_read`, GridFS files + bundle doc are deleted after serving.

### Auto-Cleanup (24h TTL)
- MongoDB TTL index deletes `bundles` documents automatically.
- A periodic cleanup task should sweep orphaned GridFS entries.
