# Cloudflare Stream Video Uploads: Backend Review and Implementation Plan

Updated: 2026-08-08

## Scope

This plan covers standalone admin video uploads to Cloudflare Stream using the tus protocol. It does not include course relationships, lessons, playback authorization, deletion, enrollment, progress tracking, or frontend changes.

No application code is changed by this document.

## End-to-end upload flow

The upload is a two-part flow:

1. The backend authorizes the admin and provisions a temporary Cloudflare tus upload URL.
2. The browser uploads the video directly to Cloudflare using that temporary URL.

The backend API token never goes to the browser. Cloudflare does not create a Cloudinary-style upload signature for this flow. The backend creates a one-time upload destination and returns that destination to the authenticated admin frontend.

```text
Admin frontend                 Yoga backend                    Cloudflare Stream
      |                              |                                |
      |-- metadata + JWT ----------->|                                |
      |                              |-- create DB row: PENDING ------>|
      |                              |-- POST tus endpoint ------------|
      |                              |<-- Location + stream-media-id --|
      |<-- temporary upload URL -----|                                |
      |                                                               |
      |----------- tus upload directly to Cloudflare ---------------->|
      |                                                               |
      |                              |<-- signed processing webhook ---|
      |                              |-- update READY or ERROR         |
      |<-- status polling (optional)-|                                |
```

### Step 1: Admin requests an upload URL

The frontend sends metadata to the backend:

```http
POST /app/api/v1/admin/uploads/videos/upload-url
Authorization: Bearer <admin-jwt>
Content-Type: application/json
```

```json
{
  "title": "Morning Yoga",
  "fileName": "morning-yoga.mp4",
  "fileType": "video/mp4",
  "fileSize": 52428800,
  "maxDurationSeconds": 3600
}
```

The backend must:

1. Verify the JWT.
2. Load the current user from the database.
3. Require `role: ADMIN` and `status: ACTIVE`.
4. Validate all metadata and reject invalid input before calling Cloudflare.
5. Create a local `CourseVideos` row with `status: PENDING`.
6. Create the Cloudflare tus request using the exact `fileSize`.
7. Read the `Location` and `stream-media-id` response headers.
8. Store `stream-media-id` as `cloudflareVideoUid` and change the local status to `UPLOADING`.
9. Return the temporary upload URL to the frontend.

Example backend response:

```json
{
  "success": true,
  "message": "Video upload initialized",
  "data": {
    "videoId": "internal-video-uuid",
    "cloudflareVideoUid": "cloudflare-video-uid",
    "uploadUrl": "https://upload.cloudflarestream.com/temporary-token",
    "expiresAt": "2026-08-08T12:00:00.000Z"
  }
}
```

The `uploadUrl` is a temporary capability and must not be logged or stored in the database. The Cloudflare API token and webhook secret must never be returned to the frontend.

### Step 2: Backend provisions the Cloudflare tus URL

The backend calls:

```text
POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/stream?direct_user=true
```

Headers:

```text
Authorization: Bearer {CLOUDFLARE_STREAM_API_TOKEN}
Tus-Resumable: 1.0.0
Upload-Length: <exact fileSize>
Upload-Metadata: name <base64>,filename <base64>,filetype <base64>,internalVideoId <base64>,maxDurationSeconds <base64>,expiry <base64>,requiresignedurls
```

The metadata values are base64 encoded individually. `requiresignedurls` is a presence flag. `expiry` should be an RFC3339 timestamp and should be configurable.

Cloudflare returns the upload destination in response headers:

```text
Location: <temporary-tus-upload-url>
stream-media-id: <permanent-cloudflare-video-uid>
```

The backend must read these headers. It must not expect them in a JSON response body or derive the UID by parsing `Location`.

### Step 3: Frontend uploads directly with tus

After receiving `uploadUrl`, the frontend uses the already-installed `tus-js-client`. The video bytes go directly from the browser to Cloudflare; they do not pass through the Yoga backend.

Conceptually, the frontend performs:

```js
const upload = new tus.Upload(file, {
  uploadUrl,
  chunkSize: 50 * 1024 * 1024,
  retryDelays: [0, 1000, 3000, 5000, 10000],
  metadata: {
    filename: file.name,
    filetype: file.type,
  },
  onProgress(bytesUploaded, bytesTotal) {
    // Update the upload progress indicator.
  },
  onSuccess() {
    // Upload bytes have reached Cloudflare; encoding may still be running.
  },
  onError(error) {
    // Show an upload failure and optionally request backend status.
  },
});

upload.start();
```

The frontend should not mark the video as ready when `onSuccess` fires. That callback means the upload finished, not that Cloudflare finished encoding the video. The authoritative final state comes from the webhook.

For tus uploads, Cloudflare requires a minimum chunk size of 5 MiB unless the complete file is smaller; a 50 MiB chunk is within the documented limit and is divisible by 256 KiB.

### Step 4: Cloudflare processes the video

After the direct upload completes, Cloudflare validates and encodes the video. The local row may move through:

```text
PENDING -> UPLOADING -> PROCESSING -> READY
                              \-----> ERROR
```

Cloudflare’s processing webhook is sent only after processing succeeds or fails. It is not a continuous upload-progress event.

### Step 5: Cloudflare sends the webhook

Configure one public HTTPS webhook URL:

```http
POST /app/api/v1/webhooks/cloudflare-stream
```

This route must not use JWT authentication. It must be registered before the global `express.json()` middleware so the raw request bytes are preserved.

The webhook handler must:

1. Read the raw request body as a `Buffer`.
2. Read the `Webhook-Signature` header.
3. Parse `time=<unix-seconds>` and `sig1=<hex-signature>`.
4. Reject missing, malformed, or stale timestamps.
5. Compute HMAC-SHA256 using:

   ```text
   HMAC(secret, time + "." + raw request body)
   ```

6. Compare the expected and received signatures using a constant-time comparison.
7. Parse JSON only after signature verification succeeds.
8. Find the local row using the webhook payload’s `uid`, which matches `cloudflareVideoUid`.
9. Update the local record from the verified Cloudflare payload.
10. Return a 2xx response for valid, already-processed, or unknown UIDs without exposing secrets.

Example successful webhook fields:

```json
{
  "uid": "cloudflare-video-uid",
  "readyToStream": true,
  "status": {
    "state": "ready",
    "pctComplete": "100",
    "errReasonCode": "",
    "errReasonText": ""
  },
  "duration": 120.5,
  "input": {
    "width": 1920,
    "height": 1080
  },
  "playback": {
    "hls": "https://.../manifest/video.m3u8",
    "dash": "https://.../manifest/video.mpd"
  }
}
```

Map `status.state === "ready"` to local `READY`. Map `status.state === "error"` to local `ERROR` and store `errReasonCode` and `errReasonText`. Repeated webhook deliveries must be safe; use idempotent updates keyed by `cloudflareVideoUid`.

### Step 6: Frontend reads status

The frontend can poll:

```http
GET /app/api/v1/admin/uploads/videos/:videoId/status
Authorization: Bearer <admin-jwt>
```

The backend returns the local status and processing information. `fileSize` must be serialized as a string because Prisma returns it as `BigInt`.

The frontend should show:

- `UPLOADING`: tus upload is still sending bytes;
- `PROCESSING`: Cloudflare received the video and is encoding it;
- `READY`: playback metadata is available;
- `ERROR`: processing failed and the error message can be shown to the admin.

## Failure handling

If local database creation fails, do not call Cloudflare. If Cloudflare initialization fails after the local row is created, update that row to `ERROR` where possible and return a generic provider error. Never return the Cloudflare API response wholesale.

If the browser loses connection during tus upload, `tus-js-client` can retry or resume using the temporary upload URL while it remains valid. If the URL expires or becomes unusable, the frontend should request a new upload initialization and the backend should create a new local upload record or explicitly restart the failed one according to the chosen retry policy.

## Confirmed repository state

The backend is an ECMAScript-module Express application using Node.js, Prisma 7.9.1, PostgreSQL, and the `@prisma/adapter-pg` adapter.

- Entry point: `src/server.js`
- Express app: `src/index.js`
- API router: `src/routes/routes.js`
- Feature modules: `src/routes/modules/**`
- Middleware: `src/middlewares/**`
- Prisma wrapper: `src/lib/prisma.js`
- Environment object: `src/config/env.config.js`
- Error wrapper/middleware: `src/utils/async-handler.util.js`
- No `AGENTS.md`, `tsconfig.json`, or project test suite was found.
- Package manager: pnpm (`pnpm-lock.yaml` is present).
- `package.json` has no test runner or HTTP test dependency.

The worktree is already dirty. The following files are existing user changes and must be preserved:

- Modified: `prisma/schema.prisma`
- Modified: `src/routes/routes.js`
- Untracked: `prisma/migrations/20260808120651_added_the_course_video_model/`
- Untracked: `src/routes/modules/admin/video-uploads/`
- Untracked: `docs/`

The untracked video module currently contains only a route with no controller/service wiring. The untracked migration creates `CourseVideos` and `VideoStatus`; it is not yet safe to assume that migration has been applied.

## Existing architecture and conventions

### Routing and responses

`src/index.js` mounts the API at `/app/api/v1`, after `cors()`, `helmet()`, `express.json({ limit: "2mb" })`, and URL-encoded parsing. `src/routes/routes.js` mounts the current video router at `/admin/uploads/videos`.

Existing admin features use a feature directory containing routes, controller, and service files. Controllers are usually wrapped with `asyncHandler` and return `{ success, message, data }` JSON responses. Service errors are plain `Error` objects with a `statusCode`; the global error handler returns `{ success: false, message }`.

### Authentication and authorization

`UserValidateMiddleware`:

1. Reads `Authorization: Bearer <token>`.
2. Verifies the JWT with `process.env.JWT_SECRET`.
3. Calls `GetAdminInfoById(verifiedData.id)`, which requires `role: ADMIN` but does not require `status: ACTIVE`.
4. Stores the JWT payload—not the database record—in `req.user`.
5. Returns 401 for a missing token, 400 for a missing admin, and 403 for an invalid token.

There is no separate admin authorization middleware. The upload endpoint therefore needs either a narrowly scoped active-admin middleware or a carefully reviewed strengthening of `UserValidateMiddleware`. The safer initial change is a reusable middleware that loads the current user with `id`, `role: ADMIN`, and `status: ACTIVE`, then sets `req.user` to that current record (without the password).

### Validation

`express-validator` is installed and routes use chains such as `body("email").isEmail()` and `body("password").trim().isLength(...)`. No `validationResult()` or reusable validation-result middleware was found. A chain alone does not reject a bad request.

The current video route is incomplete and currently unsafe:

```js
body("maxDurationSeconds").toInt().si
```

`.si` is not an express-validator method and leaves an invalid route middleware value. The route also has no controller, no validation-result handling, no `fileSize`/duration bounds, no MIME allowlist, and no explicit admin-status check. Authentication should run before the Cloudflare service is called; validation may run before authentication if the project wants to avoid database work for malformed input, but the final controller must not make a provider request until both checks pass.

Use `trim()`, `notEmpty()`, `isLength`, `isIn`, and `isInt`/`toInt` consistently. `.toInt()` is safe only after presence/type validation and should be followed by `isInt`; conversion alone does not validate `NaN`, decimals, or bounds. Add one shared validation-result middleware rather than silently accepting validation errors.

### Prisma

The schema currently contains:

- `VideoStatus`: `PENDING`, `UPLOADING`, `PROCESSING`, `READY`, `ERROR`
- `CourseVideos` with the requested media fields, `fileSize BigInt`, a unique nullable `cloudflareVideoUid`, and no user relation

The migration currently creates an unmapped table named `CourseVideos`, unlike the existing models that generally use explicit `@@map` names. It also does not add `createdById`. `BigInt` must be converted to a string before JSON serialization.

### Dependencies and utilities

Already installed and sufficient for the first implementation:

- Express 5
- express-validator
- Prisma/PostgreSQL adapter
- Node built-in `fetch` and `node:crypto`
- Existing `asyncHandler` and error middleware

No production dependency is required. Add `vitest` and `supertest` only if test tooling is approved. Do not add Axios, Multer, Zod, or another tus client to the backend. The frontend already has `tus-js-client`, but frontend work is out of scope.

## Recommended backend design

### API routes

Keep the existing feature prefix and use explicit upload-url terminology where possible:

```text
POST /app/api/v1/admin/uploads/videos/upload-url
GET  /app/api/v1/admin/uploads/videos/:videoId/status
POST /app/api/v1/webhooks/cloudflare-stream
```

`/signature` may remain for compatibility, but it is misleading: Cloudflare tus provisions a temporary direct upload URL; it does not create a Cloudinary-style signature. If retained, document it as a compatibility alias and do not expose the API token.

The webhook must be mounted outside the authenticated admin router.

### Request validation

Validate and normalize these fields before creating a provider request:

| Field | Rules |
| --- | --- |
| `title` | required, trimmed, 2–150 characters |
| `fileName` | required, trimmed, at most 255 characters |
| `fileType` | required; `video/mp4`, `video/webm`, or `video/quicktime` |
| `fileSize` | required integer, greater than 0, at most 5 GiB unless a project limit is approved |
| `maxDurationSeconds` | required integer, 1–7200 unless a project limit is approved |

The service should repeat critical numeric checks because request metadata is untrusted. Do not trust a frontend file type, size, or duration as proof of the actual uploaded media.

### Initialization flow

1. Active-admin middleware validates the bearer token, current admin existence, role, and status.
2. Validation-result middleware returns a 400 response for invalid metadata.
3. The controller passes normalized metadata to the video service.
4. The service creates a `PENDING` video row.
5. It builds tus `Upload-Metadata` with base64-encoded values.
6. It calls:

   ```text
   POST https://api.cloudflare.com/client/v4/accounts/{accountId}/stream?direct_user=true
   ```

   using the backend-only bearer token and:

   ```text
   Tus-Resumable: 1.0.0
   Upload-Length: <exact file size>
   Upload-Metadata: name <base64>,filename <base64>,filetype <base64>,internalVideoId <base64>,maxDurationSeconds <base64>,expiry <base64>,requiresignedurls
   ```

   Cloudflare’s documented tus metadata keys include `name`, `maxDurationSeconds`, `expiry`, and `requiresignedurls`; arbitrary metadata is stored in Stream’s `meta` object. The internal ID is useful for tracing, but webhook correlation must use the returned UID.
7. Read `Location` and `stream-media-id` response headers. Do not parse a JSON result or derive the UID by parsing `Location`.
8. Update the row with the Cloudflare UID and `UPLOADING` status.
9. Return the internal video ID, Cloudflare UID, temporary upload URL, and expiry.
10. If provider initialization fails, mark the row `ERROR` where possible and return a safe error. Never log or return the bearer token, webhook secret, temporary URL, or full provider response.

The temporary upload URL should be treated as a secret-like capability: return it only to the authenticated caller and do not persist it.

### Cloudflare service

Create one small service responsible for:

- endpoint construction;
- base64 tus metadata construction;
- the authenticated `fetch` request;
- extracting and validating `Location` and `stream-media-id` headers;
- sanitizing provider failures.

Use a bounded expiry, preferably configurable. Cloudflare’s current documentation specifies an RFC3339 expiry value in tus metadata. `requiresignedurls` is a presence-style metadata flag, not a base64 boolean value.

### Status endpoint

The status service should select only fields needed by the admin UI and explicitly serialize `fileSize` as a decimal string. It should return the internal status and stored processing fields. A later implementation may query Cloudflare as a reconciliation fallback, but this phase should use webhook-driven state.

### Webhook verification and state updates

Register the webhook route before the global JSON parser, using a bounded `express.raw({ type: "application/json", limit: "..." })` parser only for that route. Leave normal JSON routes on `express.json()`.

The handler should:

1. Read the raw `Buffer` and `Webhook-Signature` header.
2. Parse comma-separated `time` and `sig1` values.
3. Reject missing, malformed, or stale timestamps using a small configured tolerance.
4. Compute HMAC-SHA256 over `${time}.${rawBody}` with `CLOUDFLARE_STREAM_WEBHOOK_SECRET`.
5. Compare decoded signatures with `crypto.timingSafeEqual` only after equal-length buffers are confirmed.
6. Parse JSON after verification.
7. Find `CourseVideos` by payload `uid`.
8. Map `status.state === "ready"` to `READY` and `readyToStream` to the payload value; map `status.state === "error"` to `ERROR` and persist provider error code/text.
9. Persist available duration, dimensions, thumbnail, and playback URLs from the verified payload.
10. Treat repeated notifications as idempotent updates. Unknown UIDs should be safely acknowledged or logged without leaking payload secrets.
11. Return 2xx after a valid notification is processed.

Cloudflare sends webhooks after processing completes, not continuous upload progress. `PROCESSING` can remain in the enum for an optional future reconciliation path.

## Database recommendation

Do not add a second model. First review the existing uncommitted migration and decide whether to amend it before it is applied.

For this standalone phase, the current fields are sufficient for the upload lifecycle. Recommended changes before migration approval:

- Keep `CourseVideos` only if that naming is accepted for the standalone phase; otherwise rename it to `Video`/`Videos` consistently before applying the migration.
- Add `createdById` and a `User` relation if audit ownership is required now; this is the smallest useful addition for admin uploads.
- Add explicit table mapping if the project wants snake_case database names consistently.
- Keep `fileSize BigInt`, but serialize it as a string in DTOs.
- Keep `PROCESSING` because it matches Cloudflare’s lifecycle, even though no continuous progress webhook is expected.
- Do not add course foreign keys or lesson fields.

The migration must be generated and reviewed from the final schema with Prisma before applying it. Do not apply the currently untracked migration without checking its table naming, relation strategy, and database state.

## Environment changes

Extend `src/config/env.config.js` using its existing object style with:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_STREAM_API_TOKEN
CLOUDFLARE_STREAM_WEBHOOK_SECRET
```

Also agree on configurable values for upload expiry, maximum bytes, maximum duration, webhook timestamp tolerance, raw webhook body limit, and allowed MIME types. The current configuration module does not fail fast, so the upload and webhook services must fail safely when their required Cloudflare values are absent. Do not print secrets in startup logs or errors.

## Exact file-by-file implementation plan

| Path | Action | Change and reused pattern |
| --- | --- | --- |
| `src/index.js` | Modify | Mount the raw webhook route before `express.json`; preserve normal JSON parsing and existing health/API behavior. |
| `src/routes/routes.js` | Modify | Register the public webhook router separately from admin routes; keep the existing `/app/api/v1` prefix. |
| `src/config/env.config.js` | Modify | Add Cloudflare credentials and agreed limits using the existing `EnvConfig` object. |
| `src/middlewares/verify-user.middleware.js` | Modify or add adjacent middleware | Enforce current `ADMIN` role and `ACTIVE` status for this flow without unintentionally changing all existing admin endpoints. Reuse existing JWT/error behavior. |
| `src/middlewares/validation-result.middleware.js` | Create | Centralize `validationResult(req)` handling because no existing result middleware exists. |
| `src/routes/modules/admin/video-uploads/video-upload.routes.js` | Modify | Replace the incomplete route chain, add validation, middleware ordering, controller routes, and status endpoint. |
| `src/routes/modules/admin/video-uploads/video-upload.controller.js` | Modify | Add upload-url and status controllers using `asyncHandler` and the project response shape. |
| `src/routes/modules/admin/video-uploads/video-upload.service.js` | Modify | Create/update rows, call the Cloudflare service, handle provider failure, and serialize status DTOs. |
| `src/routes/modules/admin/video-uploads/cloudflare-stream.service.js` | Create | Implement tus endpoint request, metadata encoding, response-header extraction, and safe provider errors. |
| `src/routes/modules/webhooks/cloudflare-stream.routes.js` | Create | Public raw-body route with no JWT middleware. |
| `src/routes/modules/webhooks/cloudflare-stream.controller.js` | Create | Verify signature, parse verified body, and dispatch idempotent state update. |
| `src/routes/modules/webhooks/cloudflare-stream.service.js` | Create | Isolate HMAC verification and Cloudflare payload-to-Prisma mapping. |
| `prisma/schema.prisma` | Modify after approval | Finalize `CourseVideos`, optional `createdById` relation, mappings, and enum decisions. |
| `prisma/migrations/<timestamp>_*` | Regenerate/review | Replace or amend the untracked migration only after schema decisions; do not overwrite unrelated migrations. |
| `src/lib/enum.js` | Modify if needed | Mirror `VideoStatus` if application code imports runtime enum constants there. |
| `package.json`, `pnpm-lock.yaml` | Modify only if approved | Add test tooling only; no runtime dependency is required. |

## Migration and testing plan

Before implementation:

1. Confirm whether the existing untracked video files are disposable work in progress.
2. Confirm model/table naming and whether `createdById` is required now.
3. Finalize environment limits and upload URL lifetime.
4. Run Prisma validation/generation and review the migration SQL.

Tests should cover:

- missing/invalid bearer token;
- blocked, deleted, non-admin, and missing users;
- every request validation boundary;
- no Cloudflare call when auth or validation fails;
- exact tus headers and base64 metadata;
- missing `Location`/`stream-media-id` handling;
- provider failure row transition to `ERROR`;
- valid, stale, malformed, and tampered webhook signatures;
- raw-body verification before JSON parsing;
- ready/error payload mapping;
- duplicate webhook delivery and unknown UID behavior;
- BigInt status serialization.

Because the repository has no test setup, use Node’s built-in test runner or add Vitest/Supertest only after approval. Tests must mock `fetch` and Prisma; they should not require live Cloudflare credentials.

## Cloudflare setup

1. Create a least-privilege account API token that can create Stream uploads and manage the account’s Stream webhook.
2. Store the account ID, API token, and webhook secret only in the backend environment.
3. Register one public HTTPS notification URL with Cloudflare’s Stream webhook API or dashboard.
4. Record the returned webhook secret as `CLOUDFLARE_STREAM_WEBHOOK_SECRET`.
5. Configure the frontend origin in Cloudflare/browser tus CORS handling and expose `Location` where the client needs it; review the backend’s currently unrestricted `cors()` separately.
6. For local webhook testing, use a public Cloudflare Tunnel/Quick Tunnel; Cloudflare cannot deliver webhooks to localhost.

Official references: [Direct creator uploads with tus](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/), [resumable tus uploads](https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/), and [Stream webhooks and signature verification](https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/).

## Implementation order

1. Approve the existing work-in-progress model and route changes for preservation or amendment.
2. Finalize Prisma naming/relation and environment limits.
3. Add active-admin and validation-result middleware.
4. Implement the Cloudflare tus service.
5. Implement the upload-url service/controller/routes.
6. Add raw-body webhook registration and signature verification.
7. Add the status endpoint and DTO serialization.
8. Generate/review/apply the Prisma migration.
9. Add tests and run validation/generation/test checks.
10. Configure the Cloudflare webhook and perform an end-to-end upload.

## First approval required

Approve this first backend step: review and finalize the existing uncommitted `CourseVideos` migration/schema and video route, specifically the model name/table mapping, `createdById` relation, active-admin behavior, and the upload URL route name. Once approved, implementation can begin without changing the frontend or unrelated admin modules.
