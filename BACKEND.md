# Backend

## 1. Handover summary

This document is the developer handover for the Yoga Course Platform backend. The backend is the shared API used by:

- The public landing page for courses, PDF resources, reviews, and affiliate products.
- The user-facing learning application for authentication, course access, video playback, progress, reviews, ratings, and payments.
- The admin panel for managing courses, videos, PDF resources, affiliate products, uploads, publishing, analytics, and user access.

The service is an Express 5 API using Prisma 7 with PostgreSQL. Media is stored through Cloudinary and Cloudflare Stream. Payments are handled by Razorpay. Email is sent through the configured SMTP/Resend integration.

## 2. Technology stack

| Area | Technology |
|---|---|
| Runtime | Node.js, ECMAScript modules |
| HTTP server | Express 5 |
| Database | PostgreSQL |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Authentication | JWT and bcrypt |
| Validation | express-validator |
| Security middleware | Helmet, CORS |
| Email | Nodemailer/Resend services in `src/email` |
| Images and files | Cloudinary |
| Video | Cloudflare Stream |
| Payments | Razorpay REST API and webhooks |
| Package manager | pnpm 10.15.0 |

## 3. Repository layout

```text
src/
  config/                 Environment configuration
  email/                  Email service, templates, and notification content
  lib/                    Prisma client, enums, and admin seed
  middlewares/            JWT, admin, optional-user, and request validation middleware
  routes/
    modules/
      auth/               User authentication
      course/             Public and authenticated yoga-course features
      pdf-course/         Public and purchased PDF resources
      affiliate-products/ Public affiliate product feeds
      payment/            Razorpay order creation and payment verification
      admin/              Admin authentication and content management
    webhook/
      razorpay/           Razorpay payment webhook
      streams/            Cloudflare Stream processing webhook
  utils/                  Shared helpers, messages, and async error handling
  index.js                Express app, middleware, health route, and route mounting
  server.js               Startup, admin seeding, listening, and shutdown handling

prisma/
  schema.prisma           Database schema
  migrations/             Versioned database migrations

generated/prisma/         Generated Prisma client output (created by Prisma generate)
```

The project uses import aliases such as `#src/*`, configured in `package.json`. Keep imports consistent with the existing codebase.

## 4. Local setup

### Requirements

- Node.js with a version compatible with the installed dependencies.
- pnpm 10.15.0 or a compatible pnpm release.
- A PostgreSQL database.
- Credentials for the services used by the feature being developed.

### Install and configure

```bash
pnpm install
pnpm generate
pnpm migrate:deploy
pnpm dev
```

The default API port is `501`; override it with `PORT`. The health check is:

```text
GET http://localhost:501/health
```

Expected response:

```json
{
  "success": true,
  "message": "Yoga course API is running"
}
```

### Environment variables

Create a local `.env` file. Never commit real credentials.

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port; defaults to `501` |
| `DATABASE_URL` | PostgreSQL connection string; required by Prisma |
| `ADMIN_EMAIL` | Email for the startup-seeded admin account |
| `ADMIN_PASSWORD` | Password for the startup-seeded admin account |
| `HASH_PASSWORD_SALT` | bcrypt salt rounds |
| `JWT_SECRET` | Signing secret for user and admin JWTs |
| `USER_JWT_EXPIRES_IN` | User token lifetime; defaults to `15d` |
| `ADMIN_JWT_EXPIRES_IN` | Admin token lifetime; defaults to `3d` |
| `JWT_EXPIRES_IN` | Legacy/general JWT setting retained in configuration |
| `AUTH_EMAIL_ENCRYPTION_SECRET` | Encrypts the email value passed between signup and OTP verification |
| `OTP_EXPIRES_MINUTES` | OTP lifetime; defaults to 10 minutes |
| `PASSWORD_RESET_EXPIRES_MINUTES` | Password-reset token lifetime; defaults to 15 minutes |
| `USER_PASSWORD_RESET_URL` | User reset-page URL |
| `ADMIN_PASSWORD_RESET_URL` | Admin reset-page URL |
| `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT` | SMTP server configuration |
| `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS` | SMTP credentials |
| `RESEND_EMAIL_PROVIDER_API_KEY` | Resend provider key, when used |
| `PLATFORM_OWNER_MAIL`, `PLATFORM_OWNER_NAME` | Sender/owner notification details |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account |
| `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary credentials |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |
| `CLOUDFLARE_STREAM_API_TOKEN` | Cloudflare Stream API token |
| `CLOUDFLARE_STREAM_WEBHOOK_SECRET` | Cloudflare webhook verification secret |
| `CLOUDFLARE_IMAGES_API_TOKEN` | Cloudflare Images API token used by image upload flows |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay API credentials |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook verification secret |

At startup, the server seeds or updates the admin account using `ADMIN_EMAIL` and `ADMIN_PASSWORD`. A missing admin credential causes startup to fail.

## 5. Application bootstrap and request pipeline

`src/server.js` starts the application in this order:

1. Seed/update the admin account.
2. Listen on `EnvConfig.PORT`.
3. Check the configured email transport.
4. Close the HTTP server and Prisma connection on `SIGTERM`/`SIGINT`.

`src/index.js` configures:

- `cors()` with its current default configuration.
- `helmet()`.
- Raw-body parsing for both webhook routes.
- JSON parsing with a 2 MB limit for normal API requests.
- URL-encoded request parsing.
- `GET /health`.
- API routes under `/app/api/v1`.
- A final async error handler.

Webhook routes must remain before `express.json()` so signature verification receives the exact raw request body.

## 6. API conventions

### Base URLs

```text
User/admin API:  {API_BASE_URL}/app/api/v1
Health:          {API_BASE_URL}/health
Razorpay hook:   {API_BASE_URL}/api/webhooks/razorpay/payment
Cloudflare hook: {API_BASE_URL}/api/webhooks/cloudflare/stream
```

Protected requests use:

```http
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

Responses generally follow this shape:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

Validation failures return HTTP 400 with `success: false`, a message, and an `errors` array. The current authentication middleware uses 404 for missing/invalid tokens in some paths and 403/400 in others; clients should primarily use `success` and the message rather than depend on one status code until this is standardized.

## 7. Endpoint catalog

### 7.1 User authentication — `/auth`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/sign-up` | Public | Create a user and send email OTP. Body: `name`, `email`, `password` (6–50 chars). |
| POST | `/login` | Public | Authenticate a verified user and return a JWT. |
| POST | `/verify-otp` | Public | Verify the six-digit OTP using the encrypted email returned by signup. |
| POST | `/resend-otp` | Public | Replace/send a new OTP using the encrypted email. |
| POST | `/forgot-password` | Public | Generate a reset token and send the reset email. |
| POST | `/reset-password` | Public | Consume a reset token and set a new password. |
| GET | `/verify/me` | JWT | Verify the current user token. |

Signup/OTP flow: call `/sign-up`, retain `data.email`, submit that encrypted value to `/verify-otp`, then store `data.auth_token` from the successful verification response. Do not send the plain email to the OTP endpoints.

### 7.2 Public course and learning API — `/courses`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/` | Optional JWT | Published courses; authenticated users do not receive active purchases in this feed. |
| GET | `/top-rated` | Public | Top three landing-page courses by calculated rating. |
| GET | `/all` | Public | All landing-page course cards with rating, duration, video count, and student count. |
| GET | `/reviews` | Public | Up to 30 recent reviews for published courses and active users. |
| GET | `/my-courses` | User JWT | Published courses with active enrollment and completion counts. |
| GET | `/:courseId` | User JWT | Published course details, ready videos, purchase/access flags, and completion state. |
| GET | `/:courseId/videos` | User JWT | Ready videos for a course; requires active enrollment. |
| GET | `/:courseId/videos/:videoId/playback` | User JWT | Playback metadata/URLs; requires active enrollment. |
| GET | `/:courseId/videos/:videoId/others` | User JWT | Other videos in the same course. |
| POST | `/:courseId/review` | User JWT | Create/update the user’s course review. |
| POST | `/:courseId/videos/:videoId/rating` | User JWT | Create/update the user’s video rating. |
| POST | `/:courseId/videos/:videoId/complete` | User JWT | Mark a video completed. |

Course IDs and video IDs are expected to be UUIDs. Course access checks require `Enrollment.status = ACTIVE` and either no expiry or an expiry in the future. Revoked access is surfaced distinctly to the user.

### 7.3 PDF resources — `/pdf-courses`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/` | Public | Published PDF resources. |
| GET | `/top` | Public | Top landing-page PDF resources. |
| GET | `/all` | Public | All landing-page PDF resources. |
| GET | `/explore` | User JWT | Published PDF resources for the authenticated experience. |
| GET | `/my-courses` | User JWT | Purchased PDF resources with active enrollment. |
| GET | `/purchased` | User JWT | Alias of `/my-courses`. |
| GET | `/:pdfCourseId` | User JWT | Published PDF resource details and access state. |
| GET | `/:pdfCourseId/access` | User JWT | Access/download information for a purchased or free PDF. |

### 7.4 Affiliate products — `/affiliate-products`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/` | Public | Published affiliate products. |
| GET | `/top` | Public | Top landing-page affiliate products. |
| GET | `/all` | Public | All landing-page affiliate products. |

### 7.5 Payments — `/payments`

All payment routes require a user JWT.

| Method | Endpoint | Body | Purpose |
|---|---|---|---|
| POST | `/orders` | `courseId` | Create a Razorpay order for a published yoga course. |
| POST | `/pdf-orders` | `pdfCourseId` | Create a Razorpay order for a paid published PDF resource. |
| POST | `/verify` | `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature` | Verify the client-side Razorpay signature. |

Amounts are converted to paise for Razorpay. The backend stores the application amount in INR and creates an initial `PAYMENT_PENDING` order. Client-side verification only marks the payment as authorized/pending; the webhook marks it paid and creates or restores the enrollment. The frontend should refresh course details or `/courses/my-courses` after payment completion.

### 7.6 Admin authentication — `/admin/auth`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/login` | Public | Validate admin credentials and begin OTP login flow. |
| POST | `/verify-otp` | Public | Verify the six-digit admin login OTP. |
| GET | `/verify/me` | JWT | Verify admin login status. |
| POST | `/resend-otp?signature=...` | Public | Resend admin login OTP using the login signature. |
| POST | `/forgot-password` | Public | Start admin password reset. |
| POST | `/reset-password` | Public | Consume admin reset token. |

Admin access middleware validates the JWT and confirms the user has the `ADMIN` role.

### 7.7 Admin course management — `/admin/course`

All routes require an admin JWT.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/cloud/thumbnail/upload-url` | Generate a signed image upload URL; JPEG, PNG, and WebP up to 10 MB. |
| DELETE | `/cloud/thumbnail/:imageId` | Delete a course thumbnail asset. |
| POST | `/add/step-one` | Create initial course details and thumbnail metadata. |
| POST | `/edit/:courseId` | Edit course details and pricing. |
| GET | `/fetch/course/details/:courseId` | Fetch complete admin course details. |
| GET | `/fetch/course/step-one/:courseId` | Fetch step-one editing data. |
| GET | `/fetch/all` | Fetch all courses for the admin panel. |
| GET | `/analytics/:courseId` | Fetch course analytics. |
| PATCH | `/publish/:courseId` | Change course publication state. |
| DELETE | `/delete/:courseId` | Delete a yoga course. |
| POST | `/:courseId/users/:userId/revoke-access` | Revoke user access; body requires a reason of 5–1000 chars. |
| POST | `/:courseId/users/:userId/restore-access` | Restore user access. |

### 7.8 Admin video management — `/admin/uploads/videos`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/upload-url` | Create a Cloudflare Stream direct-upload URL and local video record. Supports MP4/WebM/QuickTime up to 50 GB. |
| GET | `/fetch?courseId=...` | List course videos. |
| PUT | `/edit` | Update video title, description, and thumbnail metadata. |
| PUT | `/reorder` | Update video order using `courseId` and `orderedIds`. |
| DELETE | `/delete/:videoId` | Delete the Cloudflare video/local record. |

Cloudflare processing changes the local `CourseVideo` state through the signed webhook. A video is exposed to learners only when it is `READY` and `readyToStream` is true.

### 7.9 Admin PDF management — `/admin/pdf-course`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/cloud/pdf/signature` | Generate a Cloudinary PDF upload signature. |
| POST | `/cloud/thumbnail/signature` | Generate a Cloudinary thumbnail upload signature. |
| GET | `/fetch` | Fetch all PDF resources for administration. |
| PUT | `/reorder` | Reorder PDF resources using `orderedIds`. |
| POST | `/add` | Add a PDF resource and pricing/access metadata. |
| POST | `/edit?id=...` | Edit a PDF resource. |
| DELETE | `/delete?id=...` | Delete a PDF resource. |

### 7.10 Admin affiliate products — `/admin/affiliate-product`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/cloud/affiliate-products/signature` | Generate a Cloudinary product-image upload signature. |
| POST | `/add` | Add an affiliate product. |
| POST | `/edit?id=...` | Edit an affiliate product. |
| PUT | `/reorder` | Reorder products using `orderedIds`. |
| GET | `/fetch` | Fetch products for administration. |
| DELETE | `/delete?id=...` | Delete a product. |

## 8. Webhook processing

### Razorpay

Configure the Razorpay Dashboard webhook as:

```text
https://<domain>/api/webhooks/razorpay/payment
```

Subscribe to `order.paid` and `payment.captured`. The handler:

1. Verifies the raw request with `X-Razorpay-Signature` and `RAZORPAY_WEBHOOK_SECRET`.
2. Reads the order/payment IDs and amount.
3. Rejects unknown or mismatched orders.
4. Uses `X-Razorpay-Event-Id` for idempotency in `RazorpayWebhookEvent`.
5. Marks the order `PAID` and payment `CAPTURED`.
6. Upserts an active enrollment for either the yoga course or PDF resource.

### Cloudflare Stream

Configure the Cloudflare Stream webhook as:

```text
https://<domain>/api/webhooks/cloudflare/stream
```

The handler verifies the `Webhook-Signature` timestamp/signature, rejects timestamps older than five minutes, and updates `CourseVideo` using the Cloudflare UID. Ready payloads store playback URLs, dimensions, duration, and processing state. Error payloads store error code/message.

## 9. Database model overview

The Prisma schema is PostgreSQL-backed and uses UUID string IDs.

| Model | Responsibility |
|---|---|
| `User` | User/admin identity, role, status, verification, and relations. |
| `AuthSession` | Refresh-session storage structure; current API primarily uses JWT access tokens. |
| `EmailVerificationToken` | Hashed OTPs, expiry, attempt count, and validation lifecycle. |
| `PasswordResetToken` | Hashed, single-user reset token with user/admin purpose. |
| `YogaCourse` | Video course metadata, pricing, publication status, and thumbnail. |
| `CourseVideo` | Cloudflare video metadata, processing state, playback URLs, ordering, ratings, and completion relations. |
| `PdfCourseResource` | PDF course/resource metadata, file URL, thumbnail, pricing, and free/paid flag. |
| `AffiliateProducts` | Published affiliate product cards and outbound links. |
| `Order` | Application order linked to a yoga course or PDF resource and Razorpay order ID. |
| `Payment` | Razorpay gateway/payment status and payment identifiers. |
| `RazorpayWebhookEvent` | Idempotency record for processed Razorpay events. |
| `Enrollment` | User access to a yoga course or PDF resource, including revoke/expiry fields. |
| `CourseReview` | One review per user/course. |
| `CourseVideoRating` | One rating per user/video. |
| `CourseVideoCompletion` | One completion record per user/video. |

Important uniqueness rules include one active relationship per user/course or user/PDF resource, one review per user/course, one rating per user/video, one completion per user/video, and one payment per order.

## 10. Business flows

### User onboarding

1. Signup creates a `USER` account and stores a hashed OTP.
2. The OTP is emailed; the frontend receives an encrypted email reference.
3. OTP verification sets `emailVerifiedAt` and returns a JWT.
4. Login is intended for verified user accounts.

### Course purchase

1. The user requests an order for a published item.
2. The backend prevents duplicate active enrollment and creates a Razorpay order.
3. The frontend completes Razorpay checkout.
4. The frontend calls `/payments/verify`.
5. Razorpay calls the signed webhook.
6. The webhook transaction marks payment/order complete and upserts enrollment.
7. The frontend refreshes course access state.

### Video learning

1. Admin creates a direct Cloudflare upload URL.
2. The admin panel uploads directly to Cloudflare and retains the returned UID.
3. Cloudflare sends processing updates to the webhook.
4. Learner endpoints return only published courses and ready videos.
5. Playback, completion, rating, and review operations require a valid active enrollment where applicable.

## 11. Development and deployment commands

```bash
pnpm dev             # Nodemon development server
pnpm start           # Production-style Node server
pnpm generate        # Generate Prisma client
pnpm migrate:deploy  # Apply committed migrations
```

There is currently no implemented automated test suite: `pnpm test` is a placeholder that exits with an error. Before production changes, add or run API integration tests for authentication, payment idempotency, access revocation, and webhook signature handling.

## 12. Operational checklist

- Confirm all required environment variables are present before deployment.
- Run `pnpm generate` after schema/client changes.
- Run `pnpm migrate:deploy` against the target database during release.
- Configure both webhook URLs with the production HTTPS domain.
- Confirm Razorpay webhook events include `X-Razorpay-Event-Id`.
- Confirm reverse proxies preserve raw webhook bodies and required signature headers.
- Confirm Cloudflare video processing can reach the webhook endpoint.
- Confirm Cloudinary/Cloudflare credentials are scoped to the intended account.
- Verify admin seed credentials are not shared in source control or logs.
- Monitor failed email delivery, payment webhook retries, video processing errors, and revoked enrollments.

## 13. Known handover notes and follow-up work

- Standardize authentication error status codes across all JWT middleware.
- Add rate limiting for login, signup, OTP, password reset, and webhook endpoints where appropriate.
- Add structured request logging and correlation IDs for payment/webhook troubleshooting.
- Add automated tests; payment and webhook flows are especially important because they change access state.
- Review whether `AuthSession` should be used for refresh-token support or removed if JWT-only authentication is the final design.
- Confirm the intended behavior of free PDF resources and whether access should be created automatically for them.
- Document the landing-page and admin-panel repositories separately if they are maintained outside this repository; this file documents their backend integration contract only.
- Review input validation consistency, especially admin add/edit routes that currently use broad `exists()` checks rather than type/range validation.

## 14. Primary files for future developers

- [src/index.js](src/index.js) — application middleware and route mounting.
- [src/server.js](src/server.js) — startup and shutdown lifecycle.
- [src/config/env.config.js](src/config/env.config.js) — environment variable mapping.
- [prisma/schema.prisma](prisma/schema.prisma) — source of truth for the database model.
- [src/routes/routes.js](src/routes/routes.js) — module-to-prefix mapping.
- [src/routes/modules/payment/payment.service.js](src/routes/modules/payment/payment.service.js) — order, verification, and webhook enrollment logic.
- [src/routes/webhook/razorpay/razorpay-webhook.controller.js](src/routes/webhook/razorpay/razorpay-webhook.controller.js) — Razorpay signature verification.
- [src/routes/webhook/streams/stream.controller.js](src/routes/webhook/streams/stream.controller.js) — Cloudflare signature verification and video state updates.
- [src/middlewares/verify-user.middleware.js](src/middlewares/verify-user.middleware.js) — required user authentication.
- [src/middlewares/admin-validation.middleware.js](src/middlewares/admin-validation.middleware.js) — required admin authentication.
