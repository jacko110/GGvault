# Phase 4 private evidence

## API

| Endpoint | Purpose |
| --- | --- |
| POST /matches/:id/evidence | Multipart upload with exactly one `file` and a `type` field: SCREENSHOT or VIDEO |
| GET /matches/:id/evidence | List safe evidence metadata |
| GET /matches/:id/evidence/:evidenceId/content | Download an authorized immutable attachment |

Only match participants may upload. Participants and active moderators/admins may list/download. The upload guard checks participation before multipart processing; the domain transaction rechecks permissions and state before committing metadata. Evidence IDs must belong to the requested match. No public storage directory or unauthenticated download link is exposed.

## Validation and storage

SCREENSHOT accepts JPEG, PNG and WEBP. VIDEO accepts MP4. MIME declaration, filename extension and inspected binary header/container markers must agree. Header checking does not fully decode media, scan malware, run OCR or validate the pictured score. Downloads are forced attachments with `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`; never embed untrusted evidence as executable content.

Configuration in `.env.example`:

| Variable | Default |
| --- | --- |
| EVIDENCE_STORAGE_DIR | storage/evidence, resolved against the API process working directory |
| EVIDENCE_SCREENSHOT_MAX_BYTES | 10485760 (10 MiB) |
| EVIDENCE_VIDEO_MAX_BYTES | 52428800 (50 MiB) |
| EVIDENCE_ALLOWED_MIME_TYPES | image/jpeg,image/png,image/webp,video/mp4 |
| EVIDENCE_ALLOWED_EXTENSIONS | .jpg,.jpeg,.png,.webp,.mp4 |

Size settings must be positive integers and cannot exceed 100 MiB. MIME/extension configuration can restrict the built-in formats but cannot enable unsupported types. Multer bounds the total accepted file size, file count, field count and field size; type-specific limits apply after parsing. Local MVP uploads are buffered in memory within those limits. Production-scale streaming, content scanning and storage quotas remain future work.

`EvidenceStorage` is the storage abstraction. `LocalEvidenceStorage` uses server-generated UUID object keys, exclusive creation (no overwrite), restricted file permissions where supported, and no client-controlled path. The storage root must be private to the service. PostgreSQL stores metadata only: id, matchId, uploadedByUserId, type, objectKey, originalFilename, mimeType, size, SHA-256 and createdAt. Legacy generic evidence columns remain for migration compatibility. Private objectKey/path details are not exposed in API metadata.

## Immutability and transaction boundaries

Each upload is immutable immediately. A submitter must upload before submitting their result. The opponent may add evidence while the result awaits a decision. Confirmation/dispute closes uploads for everyone. There are no mutation/delete endpoints. A PostgreSQL trigger also rejects updates and deletes of stored match evidence, even through direct ORM calls. Any future retention/erasure operation must be deliberately designed around this restriction.

Bytes are written before the metadata transaction. The transaction adds evidence metadata, timeline event and audit record atomically and writes the match row to serialize uploads with result actions. Failed uploads remove their uncommitted object only if the database confirms no metadata references it. An interrupted process or uncertain database outcome can leave an orphan file; operators must reconcile these without deleting referenced evidence. Filesystem and database are not a distributed transaction. Back them up together. Downloads verify size and SHA-256, rejecting changed bytes with EVIDENCE_INTEGRITY_ERROR.

Evidence bytes live under ignored storage directories and must never enter Git or phase review ZIPs. Tests use a unique disposable local directory and remove only their own object files.

Reference: [NestJS file upload](https://docs.nestjs.com/techniques/file-upload). This phase deliberately stops before AI/OCR and moderator dispute resolution.
