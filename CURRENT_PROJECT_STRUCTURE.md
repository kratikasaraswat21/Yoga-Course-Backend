# Backend: current project structure (`Backend`)

> A snapshot of the code **as it is today** (2026-10-09). It lists every folder, file, route and function so new features can be planned against the real codebase.
> Related docs in this folder: `BACKEND.md` (handover), `CODEX.md` (frontend auth API guide), `docs/cloudflare-stream-video-upload-plan.md`.

The API serves three clients: the public landing site and user app (`yoga-course-landing-page`), and the admin panel (`Admin-Panel`).

---

## 1. Tech stack

| Area | Tool |
|---|---|
| Runtime | Node.js, ES modules (`"type": "module"`) |
| HTTP | Express 5, `helmet`, `cors` |
| DB / ORM | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`); client generated into `generated/prisma/` |
| Auth | `jsonwebtoken` (JWT), `bcrypt` |
| Validation | `express-validator` |
| Email | `resend` (active); `nodemailer` SMTP is kept commented out |
| Files / images | Cloudinary (PDFs, PDF and affiliate thumbnails); Cloudflare Images (course thumbnails) |
| Video | Cloudflare Stream (direct creator uploads + webhook) |
| Payments | Razorpay REST API + webhook |
| Package manager | pnpm 10.15.0 |

Scripts:

| Script | Command |
|---|---|
| `pnpm dev` | `nodemon src/server.js` (runs `prisma generate` first) |
| `pnpm start` | `node src/server.js` |
| `pnpm generate` | `prisma generate` |
| `pnpm migrate:deploy` | `prisma migrate deploy` |

Import aliases in `package.json`: `#src/*` → `./src/*`, `#config/*`, `#middlewares/*`, `#utils/*`. The code uses `#src/...` almost everywhere. The `#modules`, `#services` and `#constants` aliases point to folders that do **not** exist.

### Environment variables (`src/config/env.config.js` → `EnvConfig`)

| Group | Keys |
|---|---|
| Server / DB | `PORT` (default 501), `DATABASE_URL` |
| Admin seed | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `HASH_PASSWORD_SALT` |
| JWT | `JWT_SECRET`, `JWT_EXPIRES_IN`, `USER_JWT_EXPIRES_IN` (15d), `ADMIN_JWT_EXPIRES_IN` (3d) |
| Auth tokens | `AUTH_EMAIL_ENCRYPTION_SECRET`, `OTP_EXPIRES_MINUTES` (10), `PASSWORD_RESET_EXPIRES_MINUTES` (15), `USER_PASSWORD_RESET_URL`, `ADMIN_PASSWORD_RESET_URL` |
| Email | `RESEND_EMAIL_PROVIDER_API_KEY`, `EMAIL_SMTP_HOST/PORT/USER/PASS`, `PLATFORM_OWNER_MAIL`, `PLATFORM_OWNER_NAME` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Cloudflare | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_WEBHOOK_SECRET`, `CLOUDFLARE_IMAGES_API_TOKEN` |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |

---

## 2. Folder tree

```text
Backend/
├── src/
│   ├── server.js                     # Entry: seeds admin, app.listen, verifies email transport, graceful shutdown
│   ├── index.js                      # Express app: cors, helmet, webhooks (raw body), json, /health, /app/api/v1, errorHandler
│   ├── config/
│   │   └── env.config.js             # EnvConfig object
│   ├── email/
│   │   ├── email.service.js          # Resend transport + send function
│   │   ├── email.templates.js        # Template switch + HTML renderer
│   │   └── templates/                # *.html email templates
│   │       ├── otp_email_verification.html
│   │       ├── admin_otp_email_verification.html
│   │       ├── password_reset.html
│   │       ├── course_access_revoked.html
│   │       └── course_access_restored.html
│   ├── lib/
│   │   ├── prisma.js                 # Prisma client (pg adapter)
│   │   ├── enum.js                   # JS mirrors of DB enums
│   │   └── seed-script.js            # AdminSeedFunction (upserts the admin user on boot)
│   ├── middlewares/
│   │   ├── token.middleware.js               # ValidateJWTToken
│   │   ├── verify-user.middleware.js         # UserValidateMiddleware
│   │   ├── optional-user.middleware.js       # OptionalUserMiddleware
│   │   ├── admin-validation.middleware.js    # AdminValidateMiddleware
│   │   └── express-validator.middleware.js   # ValidateRequestParametersMiddleware
│   ├── routes/
│   │   ├── routes.js                 # Mounts all module routers under /app/api/v1
│   │   ├── modules/
│   │   │   ├── auth/                 # User auth            (routes, controller, service)
│   │   │   ├── course/               # User courses         (routes, controller, service, course-review.service, course-progress.service)
│   │   │   ├── pdf-course/           # User PDF courses     (routes, controller, service)
│   │   │   ├── affiliate-products/   # Public products      (routes, controller; service lives in admin/affiliateProducts)
│   │   │   ├── payment/              # Razorpay orders      (routes, controller, service)
│   │   │   └── admin/
│   │   │       ├── auth/             # Admin login + OTP + reset
│   │   │       ├── course/           # Course CRUD, publish, analytics, revoke/restore access
│   │   │       ├── video-uploads/    # Cloudflare Stream upload URLs, video CRUD, reorder
│   │   │       ├── pdfManager/       # PDF course CRUD, Cloudinary signatures, reorder
│   │   │       └── affiliateProducts/# Affiliate product CRUD, signatures, reorder
│   │   └── webhook/
│   │       ├── razorpay/             # razorpay-webhook.routes.js, razorpay-webhook.controller.js
│   │       └── streams/              # cloudflare-stream-webhook.routes.js, stream.controller.js, stream.service.js
│   └── utils/
│       ├── async-handler.util.js     # asyncHandler, errorHandler
│       ├── email-token.util.js       # encryptEmail / decryptEmail (AES)
│       ├── error.messages.js         # ERROR_MESSAGES constants
│       ├── success.message.js        # SUCCESS_MESSAGES constants
│       └── helper.js                 # encodeMetadata (Cloudflare Tus metadata)
├── prisma/
│   ├── schema.prisma
│   └── migrations/                   # 21 migrations (2026-08-01 → 2026-08-26) + migration_lock.toml
├── generated/prisma/                 # Prisma client output (generated, do not edit)
├── prisma.config.ts                  # schema/migrations path, DATABASE_URL
├── docs/cloudflare-stream-video-upload-plan.md
├── .agents/skills/                   # Prisma reference skills for AI agents (not runtime code)
├── BACKEND.md, CODEX.md, README.md
├── test.json                         # Sample request payload (not used by code)
└── CURRENT_PROJECT_STRUCTURE.md      # This file
```

**Module pattern.** Each feature folder has three files:
- `*.routes.js`: Express `Router`, `express-validator` rules, and middleware chain.
- `*.controller.js`: `asyncHandler`-wrapped request handlers.
- `*.service.js`: Prisma and third-party calls.

---

## 3. App bootstrap and request pipeline

`server.js` → `startServer()`:
1. `AdminSeedFunction()` upserts the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. `app.listen(PORT)`.
3. `VerifyEmailTransportConnectionService()`.
4. `ShutDown(signal)` handles SIGTERM and SIGINT.

`index.js` middleware order:
1. `cors()`, `helmet()`
2. `/api/webhooks/cloudflare` and `/api/webhooks/razorpay`, mounted with `express.raw()` **before** the JSON parser so the HMAC signatures can be verified against the raw body.
3. `express.json({ limit: "2mb" })`, `express.urlencoded()`
4. `GET /health`
5. `/app/api/v1` → `routes.js`
6. `errorHandler`. It responds with `{ success: false, message }` and uses `error.statusCode` (default 500).

**Response shape (convention):** `{ success: boolean, message: string, data?: {...} }`. Validation failures return `400 { success:false, message, errors: [...] }`.

**Throwing errors from services:** `const e = new Error("msg"); e.statusCode = 400; throw e;`. `asyncHandler` forwards the error to `errorHandler`.

### Middlewares

| Middleware | File | Behaviour |
|---|---|---|
| `ValidateJWTToken` | `token.middleware.js` | Verifies the Bearer JWT and sets `req.user` (used by `/verify/me`) |
| `UserValidateMiddleware` | `verify-user.middleware.js` | Verifies the JWT and checks the user exists with `GetUserInfoById`. Sets `req.user = { id, email }`. Returns **404** on a missing or invalid token |
| `OptionalUserMiddleware` | `optional-user.middleware.js` | With no token it continues anonymously. With a valid token it sets `req.user`. With an invalid token it returns 403 |
| `AdminValidateMiddleware` | `admin-validation.middleware.js` | Same as the user middleware, but checks the account with `GetAdminInfoById` |
| `ValidateRequestParametersMiddleware` | `express-validator.middleware.js` | Returns 400 with `errors` if the `express-validator` rules failed |

---

## 4. Full API route map

Base prefix: **`/app/api/v1`**. Webhooks live outside it, under `/api/webhooks`.

Legend: **U** = `UserValidateMiddleware`, **OU** = `OptionalUserMiddleware`, **A** = `AdminValidateMiddleware`, **JWT** = `ValidateJWTToken`, **V** = `ValidateRequestParametersMiddleware`.

### User auth: `/auth` (`routes/modules/auth`)

| Method | Path | MW | Controller | Body / params |
|---|---|---|---|---|
| POST | `/sign-up` | V | `AuthSignUpController` | name, email, password |
| POST | `/login` | V | `AuthLoginController` | email, password → `data.auth_token` |
| POST | `/verify-otp` | V | `AuthVerifyOtpController` | email, otp |
| POST | `/resend-otp` | V | `AuthResendOtpController` | email (encrypted email token) |
| POST | `/forgot-password` | V | `AuthForgotPasswordController` | email |
| POST | `/reset-password` | V | `AuthResetPasswordController` | token, password |
| GET | `/verify/me` | JWT | `VerifyUserLoginStatusController` | → `user_info`, `is_email_verified`, `email` (encrypted, only if unverified) |

### Courses: `/courses` (`routes/modules/course`)

| Method | Path | MW | Controller |
|---|---|---|---|
| GET | `/` | OU | `getPublishedCoursesController` |
| GET | `/top-rated` | – | `getTopRatedLandingCoursesController` |
| GET | `/all` | – | `getAllLandingCoursesController` |
| GET | `/reviews` | – | `getLandingPageReviewsController` |
| GET | `/my-courses` | U | `getPurchasedCoursesController` |
| POST | `/:courseId/review` | U, V | `createCourseReviewController` (rating, comment) |
| POST | `/:courseId/videos/:videoId/rating` | U, V | `createCourseVideoRatingController` (rating) |
| POST | `/:courseId/videos/:videoId/complete` | U, V | `completeCourseVideoController` |
| GET | `/:courseId` | U, V | `getPublishedCourseDetailsController` |
| GET | `/:courseId/videos` | U, V | `getPublishedCourseVideosController` |
| GET | `/:courseId/videos/:videoId/playback` | U, V | `getCourseVideoPlaybackController` |
| GET | `/:courseId/videos/:videoId/others` | U, V | `getOtherCourseVideosController` |

### PDF courses: `/pdf-courses` (`routes/modules/pdf-course`)

| Method | Path | MW | Controller |
|---|---|---|---|
| GET | `/` | – | `getPublishedPdfCoursesController` |
| GET | `/top` | – | `getTopLandingPdfCoursesController` |
| GET | `/all` | – | `getAllLandingPdfCoursesController` |
| GET | `/explore` | U | `getPublishedPdfCoursesController` |
| GET | `/my-courses` | U | `getPurchasedPdfCoursesController` (same handler as `/purchased`) |
| GET | `/purchased` | U | `getPurchasedPdfCoursesController` |
| GET | `/:pdfCourseId/access` | U, V | `getPdfCourseAccessController` (returns `fileUrl` if owned or free) |
| GET | `/:pdfCourseId` | U, V | `getPublishedPdfCourseDetailsController` |

### Affiliate products: `/affiliate-products` (public)

| Method | Path | Controller |
|---|---|---|
| GET | `/` | `getAffiliateProductsController` |
| GET | `/top` | `getTopLandingAffiliateProductsController` (5 items) |
| GET | `/all` | `getAllLandingAffiliateProductsController` |

### Payments: `/payments` (all routes use **U** via `router.use`)

| Method | Path | MW | Controller | Body |
|---|---|---|---|---|
| POST | `/orders` | V | `createCourseOrderController` | courseId (UUID) |
| POST | `/pdf-orders` | V | `createPdfCourseOrderController` | pdfCourseId (UUID) |
| POST | `/verify` | V | `verifyCoursePaymentController` | razorpayOrderId, razorpayPaymentId, razorpaySignature |

### Admin auth: `/admin/auth`

| Method | Path | MW | Controller | Body |
|---|---|---|---|---|
| POST | `/login` | V | `VerifyAdminLoginCredentialController` | email, password (then sends an OTP) |
| POST | `/verify-otp` | V | `AdminAuthVerifyOtpController` | otp (checked against the single ADMIN account) |
| POST | `/resend-otp` | V | `ResendAdminLoginOtpVerificationOtp` | signature |
| POST | `/forgot-password` | – | `AdminForgotPasswordController` | email |
| POST | `/reset-password` | V | `AdminResetPasswordController` | token, password |
| GET | `/verify/me` | JWT | `VerifyAdminLoginStatusController` | – |

### Admin courses: `/admin/course` (all **A**)

| Method | Path | Controller | Body / params |
|---|---|---|---|
| POST | `/cloud/thumbnail/upload-url` | `generateCourseThumbnailUploadURL` | fileName, fileType, fileSize |
| DELETE | `/cloud/thumbnail/:imageId` | `deleteCourseThumbnailController` | imageId |
| POST | `/add/step-one` | `addCourseDataForStepOne` | title, description, price, discountPercentage, roundPayableAmount, thumbnailURL, thumbnailId |
| POST | `/edit/:courseId` | `editCourseDetailsController` | same as step-one |
| GET | `/fetch/all` | `fetchAllCoursesController` | – |
| GET | `/fetch/course/details/:courseId` | `fetchCourseDetailsController` | – |
| GET | `/fetch/course/step-one/:courseId` | `fetchCourseStepOneController` | – |
| PATCH | `/publish/:courseId` | `publishCourseController` | – |
| GET | `/analytics/:courseId` | `getCourseAnalyticsController` | – |
| POST | `/:courseId/users/:userId/revoke-access` | `revokeCourseAccessController` | reason (emails the user) |
| POST | `/:courseId/users/:userId/restore-access` | `restoreCourseAccessController` | (emails the user) |
| DELETE | `/delete/:courseId` | `deleteYogaCourseController` | – |

### Admin videos: `/admin/uploads/videos` (all **A**)

| Method | Path | Controller | Body |
|---|---|---|---|
| POST | `/upload-url` | `CreateCloudflareVideoUploadUrlController` | courseId, title, fileName, fileType, fileSize, maxDurationSeconds, thumbnailType |
| GET | `/fetch?courseId=` | `fetchYogaCourseVideosController` | – |
| PUT | `/edit` | `updateVideoDetailsController` | videoId, title, description, thumbnailId, thumbnailUrl |
| PUT | `/reorder` | `reorderCourseVideosController` | courseId, videoId, orderedIds |
| DELETE | `/delete/:videoId` | `deleteVideoFromCloudflare` | – |

### Admin PDF courses: `/admin/pdf-course` (all **A**)

| Method | Path | Controller | Body |
|---|---|---|---|
| POST | `/cloud/pdf/signature` | `generatePdfUploadSignature` | – |
| POST | `/cloud/thumbnail/signature` | `generatePdfThumbnailUploadSignature` | – |
| GET | `/fetch` | `fetchAllPdfCourses` | – |
| POST | `/add` | `handelAddPdfCourseController` | title, description, pdfFileName, fileUrl, thumbnailUrl, price, discount, totalPayableAmount, isAvailableForFree |
| POST | `/edit` | `handelEditPdfCourseController` | id + same fields |
| PUT | `/reorder` | `reorderPdfCoursesController` | courseId, orderedIds / sortOrder |
| DELETE | `/delete` | `deletePdfCourseController` | id |

### Admin affiliate products: `/admin/affiliate-product` (all **A**)

| Method | Path | Controller | Body |
|---|---|---|---|
| POST | `/cloud/affiliate-products/signature` | `generateAffiliateProductsUploadSignature` | – |
| GET | `/fetch` | `fetchAllAffiliateProductsController` | – |
| POST | `/add` | `handelAddAffiliateProductsController` | title, description, status, affiliateLink, buttonTitle, thumbnailUrl |
| POST | `/edit` | `handelEditAffiliateProductsController` | id + same fields |
| PUT | `/reorder` | `reorderAffiliateProductsController` | productId, orderedIds |
| DELETE | `/delete` | `deleteAffiliateProductController` | id |

### Webhooks (raw body, outside `/app/api/v1`)

| Method | Path | Controller | Notes |
|---|---|---|---|
| POST | `/api/webhooks/razorpay/payment` | `razorpayWebhookController` | HMAC check with `RAZORPAY_WEBHOOK_SECRET`; handles `order.paid` and `payment.captured`; idempotent through `RazorpayWebhookEvent` |
| POST | `/api/webhooks/cloudflare/stream` | `cloudflareStreamWebhookController` | Signature check with `verifyCloudflareStreamWebhook`; updates video status, duration and HLS/DASH URLs |

---

## 5. Database (`prisma/schema.prisma`)

**Enums:** `UserRole` (USER, ADMIN), `UserStatus` (ACTIVE, BLOCKED, DELETED), `CourseStatus` (DRAFT, PUBLISHED, ARCHIVED), `OrderStatus` (CREATED, PAYMENT_PENDING, PAID, FAILED, CANCELLED), `PaymentStatus` (CREATED, AUTHORIZED, CAPTURED, FAILED), `PaymentGateway` (RAZORPAY), `EnrollmentStatus` (ACTIVE, REVOKED, EXPIRED, REFUNDED), `RestrictionStatus` (ACTIVE, REMOVED), `TokenPurpose` (USER_PASSWORD_RESET, ADMIN_PASSWORD_RESET), `VideoStatus` (PENDING, UPLOADING, PROCESSING, READY, ERROR). `src/lib/enum.js` mirrors most of these in JS.

| Model (table) | Key fields | Relations / constraints |
|---|---|---|
| `User` (`users`) | id, name, email (unique), password, role, status, emailVerifiedAt, lastLoginAt, deletedAt | has sessions, tokens, orders, enrollments, reviews, ratings, completions |
| `AuthSession` (`auth_sessions`) | refreshTokenHash (unique), ipAddress, userAgent, expiresAt, revokedAt | → User (model exists, not used by the current auth flow) |
| `EmailVerificationToken` (`email_verification_otps`) | otpHash, attemptsCount, maxAttempts (5), expiresAt, validatedAt | → User |
| `PasswordResetToken` (`password_reset_tokens`) | userId (unique), tokenHash (unique), purpose, expiresAt | → User (cascade) |
| `YogaCourse` (`yoga_courses`) | title, description, status, price, discount, totalPayableAmount, thumbnailUrl, thumbnailId | has CourseVideo[], Order[], Enrollment[], CourseReview[] |
| `CourseVideo` (`course_videos`) | title, description, originalFileName, fileType, fileSize (BigInt), cloudflareVideoUid (unique), status, readyToStream, processingPercentage, durationSeconds, width, height, hlsUrl, dashUrl, isCustomThumbnail, thumbnailUrl, thumbnailId, errorCode, errorMessage, sortOrder | → YogaCourse (cascade); has ratings and completions |
| `PdfCourseResource` (`pdf_course_resource`) | title, description, status, price, discount, totalPayableAmount, isAvailableForFree, pdfFileName, fileUrl, thumbnailUrl, sortOrder | has Order[], Enrollment[] |
| `AffiliateProducts` (`affiliate_products`) | title, description, status, productLink, buttonTitle, thumbnailUrl, sortOrder | – |
| `Order` (`orders`) | userId, courseId?, pdfCourseId?, amount (Decimal 10,2), currency (INR), status, razorpayOrderId (unique) | → User, YogaCourse?, PdfCourseResource?; has Payment and Enrollment |
| `Payment` (`payments`) | orderId (unique), gateway, status, razorpayPaymentId (unique), razorpaySignature, method, failureReason | → Order (cascade) |
| `RazorpayWebhookEvent` (`razorpay_webhook_events`) | eventId (unique), eventType | idempotency log |
| `Enrollment` (`enrollments`) | userId, courseId?, pdfCourseId?, orderId? (unique), status, enrolledAt, expiresAt, revokedAt, revokeReason | unique (userId, courseId) and (userId, pdfCourseId) |
| `CourseReview` (`course_reviews`) | userId, courseId, rating (Float), comment | unique (userId, courseId) |
| `CourseVideoRating` (`course_video_ratings`) | userId, videoId, rating | unique (userId, videoId) |
| `CourseVideoCompletion` (`course_video_completions`) | userId, videoId, completedAt | unique (userId, videoId) |

To change the schema, edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name <name>` (this regenerates `generated/prisma`). Deploy with `pnpm migrate:deploy`.

---

## 6. Key flows

**User signup and login**
1. `sign-up` creates the user and sends an OTP email (`EMAIL_OTP_VERIFICATION`).
2. `verify-otp` checks the hashed OTP against attempts and expiry, then sets `emailVerifiedAt`.
3. `login` returns a JWT `{ id, email }` (expires per `USER_JWT_EXPIRES_IN`).
4. `/verify/me` returns the profile. If the email is unverified, it also returns an AES-encrypted email (`encryptEmail`) that the frontend sends back to `resend-otp`.

**Password reset.** `CreatePasswordResetTokenService` stores a hashed token (one per user), and the email links to `USER_PASSWORD_RESET_URL?token=...` (or the admin URL). `reset-password` verifies the token, updates the password and deletes the token.

**Admin login.** `login` checks credentials and emails an OTP. `verify-otp` checks the OTP for the ADMIN account (`GetAdminInfoWithRole`) and returns the admin JWT. `resend-otp` re-issues the OTP using the `signature` from the login response.

**Purchase (course or PDF)**
1. `createCourseOrderService` / `createPdfCourseOrderService` checks that the buyer has role USER (`ensurePurchasingUser`), calls Razorpay `POST /orders` (`razorpayRequest`), and creates `Order` + `Payment(CREATED)`.
2. `verifyCoursePaymentService` checks the HMAC of `orderId|paymentId` and marks the Payment **AUTHORIZED**. It returns `enrollmentPending: true` and does **not** grant access.
3. The Razorpay webhook calls `processRazorpayWebhookService` inside a transaction. It skips duplicate events, checks the amount, sets Order PAID and Payment CAPTURED, and upserts an ACTIVE `Enrollment`.

**Course access checks.** Services use `activeEnrollmentWhere(userId, courseId)` and `ensureEnrollment` (enrollment status ACTIVE) before returning details, playback, ratings or completions.

**Video upload (admin)**
1. `CreateCloudflareVideoUploadUrlController` creates a `CourseVideo` row (`createVideoObjectService`).
2. `getVideoUploadMetadata` asks Cloudflare for a Tus upload URL, using `encodeMetadata` for the metadata.
3. `updateVideoObjectWithCloudflareMetadata` stores the Cloudflare UID.
4. The admin browser uploads directly to Cloudflare.
5. The Stream webhook calls `updateYogaCourseVideoDetails`, which sets status, `hlsUrl`, `dashUrl` and duration.

**Publishing a course.** `publishYogaCourseService` moves a course to PUBLISHED. The course must have at least one video, and **every** video must be `READY` with `readyToStream = true`.

**Revoke or restore access.** `revokeCourseAccessService` / `restoreCourseAccessService` change the Enrollment status and reason, and email the user (`EMAIL_COURSE_ACCESS_REVOKED` / `_RESTORED`).

---

## 7. File-by-file reference (functions)

`(internal)` = not exported.

### Core

| File | Functions / exports |
|---|---|
| `src/server.js` | `startServer` (internal), `ShutDown(signal)` (internal) |
| `src/index.js` | default `app` |
| `src/routes/routes.js` | default `routers` |
| `src/config/env.config.js` | `EnvConfig` |
| `src/lib/prisma.js` | `prisma` |
| `src/lib/enum.js` | `UserRole`, `UserStatus`, `CourseStatus`, `OrderStatus`, `PaymentStatus`, `PaymentGateway`, `EnrollmentStatus`, `RestrictionStatus`, `TokenPurpose` |
| `src/lib/seed-script.js` | `AdminSeedFunction()` |

### Email

| File | Functions |
|---|---|
| `email/email.service.js` | `VerifyEmailTransportConnectionService()`, `SendEmailNotificationService(email, templateName, data)` |
| `email/email.templates.js` | `RenderEmailTemplate(templateName, variables)`, `GetEmailTemplate(templateName, data)`; internal `EmailOtpVerificationTemplate`, `EmailPasswordResetTemplate`, `AdminLoginOtpVerificationTemplate`, `CourseAccessRevokedTemplate`, `CourseAccessRestoredTemplate` |

Template names accepted by `GetEmailTemplate`: `EMAIL_OTP_VERIFICATION`, `EMAIL_PASSWORD_RESET`, `ADMIN_EMAIL_OTP_VERIFICATION`, `EMAIL_COURSE_ACCESS_REVOKED`, `EMAIL_COURSE_ACCESS_RESTORED`.

### Utils

| File | Functions / exports |
|---|---|
| `utils/async-handler.util.js` | `asyncHandler(handler)` (also default export), `errorHandler(error, req, res, next)` |
| `utils/email-token.util.js` | `encryptEmail(email)`, `decryptEmail(encryptedEmail)`; internal `getEncryptionKey` |
| `utils/helper.js` | `encodeMetadata(metadata)` |
| `utils/error.messages.js` | `ERROR_MESSAGES` |
| `utils/success.message.js` | `SUCCESS_MESSAGES` |

### Middlewares

`ValidateJWTToken`, `UserValidateMiddleware`, `OptionalUserMiddleware`, `AdminValidateMiddleware`, `ValidateRequestParametersMiddleware` (see section 3).

### User auth: `routes/modules/auth/`

| File | Functions |
|---|---|
| `auth.controller.js` | `AuthSignUpController`, `AuthLoginController`, `AuthVerifyOtpController`, `AuthResendOtpController`, `AuthForgotPasswordController`, `AuthResetPasswordController`, `VerifyUserLoginStatusController` |
| `auth.service.js` | `GetUserByEmailService`, `GetUserInfoById`, `CreateUserService`, `CreateEmailVerificationTokenService`, `GetActiveEmailVerificationTokenService`, `IncrementOtpAttemptsService`, `VerifyUserEmailService`, `CreatePasswordResetTokenService`, `GetPasswordResetTokenService`, `ResetUserPasswordService` |

### Courses: `routes/modules/course/`

| File | Functions |
|---|---|
| `course.controller.js` | `completeCourseVideoController`, `createCourseReviewController`, `createCourseVideoRatingController`, `getPublishedCoursesController`, `getTopRatedLandingCoursesController`, `getAllLandingCoursesController`, `getLandingPageReviewsController`, `getPurchasedCoursesController`, `getPublishedCourseDetailsController`, `getPublishedCourseVideosController`, `getCourseVideoPlaybackController`, `getOtherCourseVideosController` |
| `course.service.js` | `getPurchasedCoursesService`, `getPublishedCoursesService`, `getTopRatedLandingCoursesService`, `getAllLandingCoursesService`, `getLandingPageReviewsService`, `getPublishedCourseVideosService`, `getPublishedCourseDetailsService`, `getCourseVideoPlaybackService`, `getOtherCourseVideosService`; internal `activeEnrollmentWhere`, `ensureEnrollment`, `getLandingPageCourses` |
| `course-review.service.js` | `createCourseReviewService`, `createCourseVideoRatingService`; internal `activeEnrollmentWhere`, `validateRating`, `ensureCoursePurchase` |
| `course-progress.service.js` | `completeCourseVideoService`; internal `activeEnrollmentWhere` |

### PDF courses: `routes/modules/pdf-course/`

| File | Functions |
|---|---|
| `pdf-course.controller.js` | `getPublishedPdfCoursesController`, `getTopLandingPdfCoursesController`, `getAllLandingPdfCoursesController`, `getPurchasedPdfCoursesController`, `getPublishedPdfCourseDetailsController`, `getPdfCourseAccessController` |
| `pdf-course.service.js` | `getTopLandingPdfCoursesService`, `getAllLandingPdfCoursesService`, `getPublishedPdfCoursesService`, `getPublishedPdfCourseDetailsService`, `getPurchasedPdfCoursesService`, `getPdfCourseAccessService`; internal `activePdfEnrollmentWhere`, `toPublicPdf` (converts price fields to numbers), `getLandingPdfCourses(take)`. List and detail responses include `fileUrl` only when `isAvailableForFree` is true |

### Affiliate products (public): `routes/modules/affiliate-products/`

| File | Functions |
|---|---|
| `affiliate-products.controller.js` | `getAffiliateProductsController`, `getTopLandingAffiliateProductsController`, `getAllLandingAffiliateProductsController` (they call services in `admin/affiliateProducts/affiliate-products.service.js`) |

### Payments: `routes/modules/payment/`

| File | Functions |
|---|---|
| `payment.controller.js` | `createCourseOrderController`, `createPdfCourseOrderController`, `verifyCoursePaymentController` |
| `payment.service.js` | `createCourseOrderService`, `createPdfCourseOrderService`, `verifyCoursePaymentService`, `processRazorpayWebhookService`; internal `razorpayRequest(path, options)`, `ensurePurchasingUser(userId)` |

### Admin auth: `routes/modules/admin/auth/`

| File | Functions |
|---|---|
| `auth.controller.js` | `VerifyAdminLoginCredentialController`, `VerifyAdminLoginStatusController`, `AdminForgotPasswordController`, `AdminResetPasswordController`, `AdminAuthVerifyOtpController`, `ResendAdminLoginOtpVerificationOtp` |
| `auth.service.js` | `GetAdminInfoByEmailService`, `GetAdminInfoWithRole`, `GetAdminInfoById`, `CreatePasswordResetTokenService`, `GetPasswordResetTokenService`, `ResetAdminPasswordService`, `CreateAdminEmailVerificationTokenService`, `ReCreateAdminEmailVerificationOTP`, `GetActiveEmailVerificationTokenService`, `VerifyUserEmailService`, `IncrementOtpAttemptsService` |

### Admin courses: `routes/modules/admin/course/`

| File | Functions |
|---|---|
| `course.controller.js` | `generateCourseThumbnailUploadURL`, `deleteCourseThumbnailController`, `addCourseDataForStepOne`, `editCourseDetailsController`, `fetchCourseDetailsController`, `fetchCourseStepOneController`, `publishCourseController`, `fetchAllCoursesController`, `getCourseAnalyticsController`, `deleteYogaCourseController`, `revokeCourseAccessController`, `restoreCourseAccessController` |
| `course.service.js` | `getCloudFlairImageUploadURL`, `deleteThumbnailImageService`, `addYogaCourseForStepOne`, `updateYogaCourseDetailsService`, `getYogaCourseDetailsService`, `getYogaCourseStepOneService`, `publishYogaCourseService`, `fetchAllYogaCoursesService`, `getYogaCourseAnalyticsService`, `revokeCourseAccessService`, `restoreCourseAccessService`, `deleteYogaCourseService`; internal `isValidCloudflareImageId`, `deleteCloudflareImageIfPresent`, `averageRating` |

### Admin videos: `routes/modules/admin/video-uploads/`

| File | Functions |
|---|---|
| `video-upload.controller.js` | `CreateCloudflareVideoUploadUrlController`, `fetchYogaCourseVideosController`, `reorderCourseVideosController`, `updateVideoDetailsController`, `deleteVideoFromCloudflare` |
| `video-upload.service.js` | `createVideoObjectService`, `getVideoUploadMetadata`, `updateVideoObjectWithCloudflareMetadata`, `fetchCourseVideosService`, `reorderCourseVideosService`, `fetchVideoDetailsService`, `updateVideoDetailsService`, `deleteYogaCourseVideoService`, `deleteYogaCourseVideoFromCloudFlair` |

### Admin PDF manager: `routes/modules/admin/pdfManager/`

| File | Functions |
|---|---|
| `pdf-manager.controller.js` | `generatePdfUploadSignature`, `generatePdfThumbnailUploadSignature`, `handelAddPdfCourseController`, `handelEditPdfCourseController`, `fetchAllPdfCourses`, `deletePdfCourseController`, `reorderPdfCoursesController` |
| `pdf-manager.service.js` | `signPdfFileService`, `signPdfCourseThumbnailService`, `addPdfCourseService`, `editPdfCourseService`, `fetchPdfCourse`, `deletePdfCourseService`, `reorderPdfCoursesService` |

### Admin affiliate products: `routes/modules/admin/affiliateProducts/`

| File | Functions |
|---|---|
| `affiliate-products.controller.js` | `generateAffiliateProductsUploadSignature`, `handelAddAffiliateProductsController`, `handelEditAffiliateProductsController`, `deleteAffiliateProductController`, `fetchAllAffiliateProductsController`, `reorderAffiliateProductsController` |
| `affiliate-products.service.js` | `signAffiliateFileService`, `addAffiliateProductService`, `editAffiliateProductService`, `deleteAffiliateProductService`, `fetchAffiliateProductsService`, `fetchPublishedAffiliateProductsService`, `getTopLandingAffiliateProductsService`, `getAllLandingAffiliateProductsService`, `reorderAffiliateProductsService`; internal `getLandingAffiliateProductsService(take)` |

### Webhooks: `routes/webhook/`

| File | Functions |
|---|---|
| `razorpay/razorpay-webhook.controller.js` | `razorpayWebhookController`; internal `isValidSignature(rawBody, signature)` |
| `streams/stream.controller.js` | `verifyCloudflareStreamWebhook({ rawBody, signatureHeader, webhookSecret })`, `cloudflareStreamWebhookController` |
| `streams/stream.service.js` | `updateYogaCourseVideoDetails(video_id, data)` |

---

## 8. Adding a new feature (follow the existing pattern)

1. **Schema:** add or modify models in `prisma/schema.prisma` and create a migration.
2. **Folder:** create `src/routes/modules/<feature>/` (or `modules/admin/<feature>/` for admin) with `<feature>.routes.js`, `<feature>.controller.js` and `<feature>.service.js`.
3. **Routes:** add `express-validator` rules (`body()`, `param()`, `query()`), then `ValidateRequestParametersMiddleware`, then the auth middleware (`UserValidateMiddleware` / `AdminValidateMiddleware`), then the controller.
4. **Controllers:** wrap them in `asyncHandler`, read `req.user.id`, call the service, and respond with `{ success, message, data }`. Put message strings in `utils/success.message.js` / `utils/error.messages.js`.
5. **Services:** use `prisma` from `#src/lib/prisma.js`. Throw `Error` with `statusCode` for expected failures.
6. **Mount:** register the router in `src/routes/routes.js`.
7. **Email:** add an HTML file in `email/templates/`, a template function plus a `case` in `email.templates.js`, then call `SendEmailNotificationService(email, "NAME", data)`.
8. **Env:** add any new keys to `EnvConfig` in `src/config/env.config.js`.

## 9. Known quirks (current state, not yet changed)

- User and admin auth middlewares return **404** (not 401) for a missing or invalid token. The frontend relies on this.
- Some names are misspelled: `handel...Controller` (handle), `getCloudFlairImageUploadURL` / `deleteYogaCourseVideoFromCloudFlair` (Cloudflare). Keep the existing names when calling them.
- `/pdf-courses/my-courses` and `/pdf-courses/purchased` are duplicates.
- The `AuthSession` model and `RestrictionStatus` enum exist but are not used by the current flows.
- In admin affiliate and PDF routes, `ValidateRequestParametersMiddleware` runs **before** `AdminValidateMiddleware`. Other modules use the opposite order.
- `package.json` aliases `#modules`, `#services` and `#constants` point to folders that don't exist.
