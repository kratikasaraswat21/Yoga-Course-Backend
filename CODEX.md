# Frontend Authentication API Guide

This document describes the public authentication routes available to the frontend.

## Base URL

```text
{API_BASE_URL}/app/api/v1
```

For local development, replace `{API_BASE_URL}` with the backend host and port, for example:

```text
http://localhost:5000/app/api/v1
```

All requests with a body must send JSON:

```http
Content-Type: application/json
```

## Authentication flow

1. Call `POST /sign-up` with the user's name, email, and password.
2. Keep the encrypted `data.email` value returned by signup.
3. Ask the user for the OTP sent to their email.
4. Call `POST /verify-otp` with the encrypted email value and OTP.
5. Store the returned `data.auth_token` securely in the frontend.
6. Send that token as `Authorization: Bearer <token>` when calling `GET /verify/me`.

## Routes

### 1. Sign up

```http
POST /sign-up
```

Request body:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "secret123"
}
```

Validation:

- `name` is required.
- `email` must be valid.
- `password` must contain 6–50 characters.

Success response (`201`):

```json
{
  "message": "OTP sent successfully. Please Check your Mail.",
  "success": true,
  "data": {
    "requires_email_verification": true,
    "email": "<encrypted-email>"
  }
}
```

### 2. Login

```http
POST /login
```

Request body:

```json
{
  "email": "jane@example.com",
  "password": "secret123"
}
```

Success response (`200`):

```json
{
  "message": "User logged in successfully.",
  "success": true,
  "data": {
    "auth_token": "<jwt-token>"
  }
}
```

Store `data.auth_token` and use it as a Bearer token for protected requests.

### 3. Verify email OTP

```http
POST /verify-otp
```

Request body:

```json
{
  "email": "<encrypted-email>",
  "otp": "123456"
}
```

The `email` value must be the encrypted value returned by `/sign-up`; do not send the plain email. The OTP must be exactly six digits.

Success response (`200`):

```json
{
  "message": "Email verified successfully.",
  "success": true,
  "data": {
    "auth_token": "<jwt-token>"
  }
}
```

The returned token can be used for authenticated requests.

### 4. Resend email OTP

```http
POST /resend-otp
```

Request body:

```json
{
  "email": "<encrypted-email>"
}
```

Send the encrypted `data.email` value returned by `/sign-up` or a previous `/resend-otp` response. Do not send the plain email.

Success response (`200`):

```json
{
  "message": "OTP sent successfully. Please Check your Mail.",
  "success": true,
  "data": {
    "requires_email_verification": true,
    "email": "<encrypted-email>"
  }
}
```

### 5. Request password reset

```http
POST /forgot-password
```

Request body:

```json
{
  "email": "jane@example.com"
}
```

Success response (`200`):

```json
{
  "message": "A password reset link has been sent.",
  "success": true,
  "data": {
    "rawToken": "<password-reset-token>"
  }
}
```

The backend also sends a reset link by email. The frontend reset screen should submit the token and the new password to `/reset-password`.

### 6. Reset password

```http
POST /reset-password
```

Request body:

```json
{
  "token": "<password-reset-token>",
  "password": "newSecret123"
}
```

Validation:

- `token` is required.
- `password` must contain 6–100 characters.

Success response (`200`):

```json
{
  "message": "Password Updated successfully.",
  "success": true
}
```

### 7. Verify current login

```http
GET /verify/me
Authorization: Bearer <jwt-token>
```

Example response (`200`):

```json
{
  "message": "User Verified Successfully",
  "success": true,
  "data": {
    "user_info": {
      "id": "<user-id>",
      "name": "Jane Doe",
      "email": "jane@example.com"
    }
  }
}
```

The exact `user_info` fields are returned by the backend user query and should be treated as the current authenticated user.

## Common error responses

Validation errors return status `400`:

```json
{
  "message": "Validation failed. Please check the provided information.",
  "success": false,
  "errors": [
    {
      "type": "field",
      "value": "bad-email",
      "msg": "Please provide a valid email address.",
      "path": "email",
      "location": "body"
    }
  ]
}
```

Other common statuses:

| Status | Meaning |
| --- | --- |
| `400` | Invalid credentials, duplicate user, invalid OTP, or invalid reset token |
| `401` | Authorization token was not provided |
| `403` | Authorization token is invalid or expired |
| `404` | User was not found |
| `429` | Too many invalid OTP attempts |

For every protected request, send the token in this format:

```js
const response = await fetch(`${API_BASE_URL}/app/api/v1/auth/verify/me`, {
  headers: {
    Authorization: `Bearer ${authToken}`,
  },
});
```

## Email encryption configuration

The backend uses AES-256-GCM to encrypt the email reference returned for OTP verification. Configure a dedicated server-side secret in the environment:

```env
AUTH_EMAIL_ENCRYPTION_SECRET=<long-random-secret>
```

The frontend must treat the encrypted email as an opaque value. It must not attempt to decrypt or modify it. The backend decrypts it before looking up the user.
