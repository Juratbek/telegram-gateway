# @deployed/telegram-gateway

TypeScript SDK for the [Telegram Gateway API](https://core.telegram.org/gateway) — send and verify OTP codes via Telegram at a fraction of the cost of SMS.

> **Note:** The Telegram Gateway API is a paid service — you will need a funded account and an access token to send requests. See [pricing](https://core.telegram.org/gateway) for current rates. Sending codes to your own phone number is always free and can be used for testing.

## Table of Contents

- [Getting Your Access Token](#getting-your-access-token)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API](#api)
  - [`new TelegramGateway(options)`](#new-telegramgatewayoptions)
  - [`sendVerificationMessage(params)`](#sendverificationmessageparams)
  - [`checkSendAbility(params)`](#checksendabilityparams)
  - [`checkVerificationStatus(params)`](#checkverificationstatusparams)
  - [`revokeVerificationMessage(params)`](#revokeverificationmessageparams)
- [Callback Signature Verification](#callback-signature-verification)
  - [`verifyCallbackSignature(apiToken, report, maxAgeSeconds?)`](#verifycallbacksignatureapitoken-report-maxageseconds)
  - [Express Example](#express-example)
  - [Hono Example](#hono-example)
  - [NestJS Example](#nestjs-example)
- [Error Handling](#error-handling)
- [Types](#types)
- [Resources](#resources)
- [License](#license)

## Getting Your Access Token

1. Create an account at [gateway.telegram.org](https://gateway.telegram.org)
2. Fund your account via [Fragment](https://fragment.com)
3. Go to account settings and copy your API token
4. You can test for free by sending codes to your own phone number

For a full walkthrough, see the official [Quick-start Guide](https://core.telegram.org/gateway/verification-tutorial).

## Installation

```bash
npm install @deployed/telegram-gateway
```

## Quick Start

```ts
import { TelegramGateway } from "@deployed/telegram-gateway";

const gateway = new TelegramGateway({
  accessToken: process.env.TG_GATEWAY_TOKEN!,
});

// Send a 6-digit code
const result = await gateway.sendVerificationMessage({
  phone_number: "+1234567890",
  code_length: 6,
  ttl: 300, // 5 minutes
});

console.log(result.request_id); // use this to check status later
```

## API

### `new TelegramGateway(options)`

| Option        | Type       | Required | Description                                   |
|---------------|------------|----------|-----------------------------------------------|
| `accessToken` | `string`   | Yes      | API token from gateway.telegram.org           |
| `baseUrl`     | `string`   | No       | Override the API base URL (useful for testing) |
| `fetch`       | `Function` | No       | Custom `fetch` implementation                 |

---

### `sendVerificationMessage(params)`

Send a verification message to a phone number. Charges apply per successful delivery. Free when sending to your own number. [Docs](https://core.telegram.org/gateway/api#sendverificationmessage)

| Parameter         | Type     | Required | Description                                                                                          |
|-------------------|----------|----------|------------------------------------------------------------------------------------------------------|
| `phone_number`    | `string` | Yes      | Phone number in E.164 format (e.g. `"+998901234567"`)                                                |
| `request_id`      | `string` | No       | ID from `checkSendAbility` — makes this call free of charge                                          |
| `sender_username` | `string` | No       | Username of a [verified](https://telegram.org/verify) Telegram channel owned by the token holder     |
| `code`            | `string` | No       | Your own verification code (4–8 digits). If set, `code_length` is ignored                            |
| `code_length`     | `number` | No       | Length of the code for Telegram to generate (4–8). Only used when `code` is not provided              |
| `callback_url`    | `string` | No       | HTTPS URL to receive [delivery reports](https://core.telegram.org/gateway/api#report-delivery) (max 256 bytes) |
| `payload`         | `string` | No       | Custom internal payload, not shown to the user (max 128 bytes)                                       |
| `ttl`             | `number` | No       | Time-to-live in seconds (30–3600). Defaults to `120` (2 minutes). If undelivered within this window, the fee is automatically refunded |

Returns a `RequestStatus` object.

```ts
const status = await gateway.sendVerificationMessage({
  phone_number: "+998901234567",
  code_length: 6,
  callback_url: "https://example.com/webhook",
  ttl: 300,
  payload: "session_abc",
});

console.log(status.request_id);        // unique request identifier
console.log(status.request_cost);       // cost charged for this request
console.log(status.remaining_balance);  // remaining account balance
```

### `checkSendAbility(params)`

Check whether a verification message can be delivered to the given phone number before actually sending it. [Docs](https://core.telegram.org/gateway/api#checksendability)

This is useful when you want to verify deliverability first — for example, to decide between Telegram and an SMS fallback before triggering the message. If the check succeeds, you receive a `request_id` that makes the subsequent `sendVerificationMessage` call free (only one fee is charged across both calls).

If the number is not on Telegram or can't receive messages, an error is returned and no fee is charged.

> **Note:** This method is **not free** — if the check confirms deliverability, a fee applies immediately. However, calling `sendVerificationMessage` with the returned `request_id` won't charge again. The total cost is the same as calling `sendVerificationMessage` directly. If you don't need to check before sending, you can skip this method entirely.

| Parameter      | Type     | Required | Description                                       |
|----------------|----------|----------|---------------------------------------------------|
| `phone_number` | `string` | Yes      | Phone number in E.164 format (e.g. `"+998901234567"`) |

Returns a `SendAbilityResult` — either `{ ok: true, result: RequestStatus }` or `{ ok: false, error: string }`. Never throws on API errors.

```ts
const check = await gateway.checkSendAbility({
  phone_number: "+998901234567",
});

if (check.ok) {
  // Fee was already charged — the send below is free
  const status = await gateway.sendVerificationMessage({
    phone_number: "+998901234567",
    request_id: check.result.request_id,
    code_length: 6,
  });
} else {
  // No fee charged — fall back to SMS or notify the user
  console.log("Cannot send via Telegram:", check.error);
}
```

### `checkVerificationStatus(params)`

Check the delivery status of a previously sent message and optionally validate the code entered by the user. [Docs](https://core.telegram.org/gateway/api#checkverificationstatus)

This method serves two purposes:

1. **Delivery tracking** — check whether the message was `sent`, `delivered`, `read`, `expired`, or `revoked`.
2. **Code validation** — if you used `code_length` (letting Telegram generate the code), pass the user-entered code in the `code` parameter and Telegram will verify it server-side. The `verification_status` will be one of: `code_valid`, `code_invalid`, `code_max_attempts_exceeded`, or `expired`.

Even if you set your own code via `sendVerificationMessage`, Telegram recommends calling this method with the correct code after the user succeeds, so they can track conversion rates for your verifications.

> **Note:** This method is always **free** — no fee is charged regardless of how many times you call it.

| Parameter    | Type     | Required | Description                                                                  |
|--------------|----------|----------|------------------------------------------------------------------------------|
| `request_id` | `string` | Yes      | The unique identifier returned by `sendVerificationMessage`                  |
| `code`       | `string` | No       | The code the user entered. If provided, Telegram validates it server-side    |

Returns a `RequestStatus` object.

```ts
const status = await gateway.checkVerificationStatus({
  request_id: "abc123",
  code: "123456",
});

if (status.verification_status?.status === "code_valid") {
  // user entered the correct code
}

if (status.verification_status?.status === "code_invalid") {
  // wrong code — prompt the user to try again
}

if (status.verification_status?.status === "code_max_attempts_exceeded") {
  // too many wrong attempts
}

if (status.verification_status?.status === "expired") {
  // code has expired — send a new one
}

// You can also check delivery status
console.log(status.delivery_status?.status); // "sent" | "delivered" | "read" | "expired" | "revoked"
```

### `revokeVerificationMessage(params)`

Revoke a previously sent verification message so the user can no longer see or use the code. [Docs](https://core.telegram.org/gateway/api#revokeverificationmessage)

This is useful when you want to invalidate a code before it expires — for example, if the user cancels the login flow, requests a new code, or you detect suspicious activity. Once revoked, the message is deleted from the Telegram chat and the `delivery_status` changes to `revoked`.

Revocation is **best-effort**: if the user has already read or used the code, the revocation may not have a practical effect. No error is thrown in this case — the call still succeeds.

> **Note:** This method is always **free** — no fee is charged for revoking a message.

| Parameter    | Type     | Required | Description                                                    |
|--------------|----------|----------|----------------------------------------------------------------|
| `request_id` | `string` | Yes      | The unique identifier returned by `sendVerificationMessage`    |

Returns `true` if the revocation was accepted by the server.

```ts
// Revoke after the user requests a new code
await gateway.revokeVerificationMessage({
  request_id: previousRequestId,
});

// You can verify the revocation via checkVerificationStatus
const status = await gateway.checkVerificationStatus({
  request_id: previousRequestId,
});
console.log(status.delivery_status?.status); // "revoked"
```

---

## Callback Signature Verification

When you pass a `callback_url` to `sendVerificationMessage`, Telegram sends POST requests to that URL with delivery status updates (e.g. `delivered`, `read`). Each request is signed so you can verify it actually came from Telegram and wasn't tampered with. [Docs](https://core.telegram.org/gateway/api#checking-report-integrity)

Telegram includes two headers with every callback:

| Header                  | Description                                              |
|-------------------------|----------------------------------------------------------|
| `X-Request-Timestamp`   | Unix timestamp (seconds) of when the request was signed  |
| `X-Request-Signature`   | HMAC-SHA256 hex digest proving the request is authentic   |

The signature is computed as `HMAC-SHA256(SHA256(apiToken), "<timestamp>\n<body>")`. The included `verifyCallbackSignature` helper handles this for you.

### `verifyCallbackSignature(apiToken, report, maxAgeSeconds?)`

| Parameter       | Type             | Required | Description                                                          |
|-----------------|------------------|----------|----------------------------------------------------------------------|
| `apiToken`      | `string`         | Yes      | Your Telegram Gateway API token (same one used to create the client) |
| `report`        | `CallbackReport` | Yes      | Object containing `timestamp`, `signature`, and `body` (see below)  |
| `maxAgeSeconds` | `number`         | No       | Maximum allowed age of the timestamp in seconds. Defaults to `300` (5 minutes). Requests older than this are rejected to prevent replay attacks |

The `report` object:

| Field       | Type     | Description                                            |
|-------------|----------|--------------------------------------------------------|
| `timestamp` | `string` | Value of the `X-Request-Timestamp` header              |
| `signature` | `string` | Value of the `X-Request-Signature` header              |
| `body`      | `string` | The raw POST body as a string (not parsed JSON)        |

Returns `true` if the signature is valid and the timestamp is within the allowed age window. Returns `false` if the signature doesn't match, the timestamp is invalid, or the request is too old.

> **Important:** You must pass the **raw request body** as a string, not a parsed object. Parsing and re-serializing JSON can change key order or whitespace, which will break the signature check.

### Express Example

```ts
import express from "express";
import { verifyCallbackSignature } from "@deployed/telegram-gateway";

const app = express();

// Use express.text() instead of express.json() to preserve the raw body
app.post("/webhook", express.text({ type: "application/json" }), (req, res) => {
  const isValid = verifyCallbackSignature(process.env.TG_GATEWAY_TOKEN!, {
    timestamp: req.headers["x-request-timestamp"] as string,
    signature: req.headers["x-request-signature"] as string,
    body: req.body,
  });

  if (!isValid) {
    return res.status(403).send("Invalid signature");
  }

  const update = JSON.parse(req.body);
  console.log(update); // process the delivery report
  res.sendStatus(200);
});
```

### Hono Example

```ts
import { Hono } from "hono";
import { verifyCallbackSignature } from "@deployed/telegram-gateway";

const app = new Hono();

app.post("/webhook", async (c) => {
  const body = await c.req.text();

  const isValid = verifyCallbackSignature(c.env.TG_GATEWAY_TOKEN, {
    timestamp: c.req.header("x-request-timestamp") ?? "",
    signature: c.req.header("x-request-signature") ?? "",
    body,
  });

  if (!isValid) {
    return c.text("Invalid signature", 403);
  }

  const update = JSON.parse(body);
  console.log(update); // process the delivery report
  return c.text("OK", 200);
});
```

### NestJS Example

```ts
import { Controller, Post, Req, Res, HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";
import { verifyCallbackSignature } from "@deployed/telegram-gateway";

@Controller("webhook")
export class WebhookController {
  @Post()
  handleCallback(@Req() req: Request, @Res() res: Response) {
    const isValid = verifyCallbackSignature(process.env.TG_GATEWAY_TOKEN!, {
      timestamp: req.headers["x-request-timestamp"] as string,
      signature: req.headers["x-request-signature"] as string,
      body: req.body as string,
    });

    if (!isValid) {
      return res.status(HttpStatus.FORBIDDEN).send("Invalid signature");
    }

    const update = JSON.parse(req.body as string);
    console.log(update); // process the delivery report
    return res.status(HttpStatus.OK).send("OK");
  }
}
```

Since NestJS uses `express.json()` by default (which parses the body), you need to configure raw body access. In your `main.ts`, enable the `rawBody` option:

```ts
const app = await NestFactory.create(AppModule, {
  rawBody: true,
});
```

Then use `@RawBody()` instead of reading from `req.body`:

```ts
import { Controller, Post, RawBody, Headers, HttpStatus, HttpCode, ForbiddenException } from "@nestjs/common";
import { verifyCallbackSignature } from "@deployed/telegram-gateway";

@Controller("webhook")
export class WebhookController {
  @Post()
  @HttpCode(HttpStatus.OK)
  handleCallback(
    @Headers("x-request-timestamp") timestamp: string,
    @Headers("x-request-signature") signature: string,
    @RawBody() rawBody: Buffer,
  ) {
    const body = rawBody.toString("utf-8");

    const isValid = verifyCallbackSignature(process.env.TG_GATEWAY_TOKEN!, {
      timestamp,
      signature,
      body,
    });

    if (!isValid) {
      throw new ForbiddenException("Invalid signature");
    }

    const update = JSON.parse(body);
    console.log(update); // process the delivery report
    return "OK";
  }
}
```

## Error Handling

All API errors throw a `TelegramGatewayError` with a `code` property matching the Telegram error string (e.g. `ACCESS_TOKEN_INVALID`).

```ts
import { TelegramGatewayError } from "@deployed/telegram-gateway";

try {
  await gateway.sendVerificationMessage({ phone_number: "+1234567890" });
} catch (err) {
  if (err instanceof TelegramGatewayError) {
    console.error(err.code); // e.g. "PHONE_NUMBER_INVALID"
  }
}
```

## Types

All request/response types are exported for full TypeScript support:

```ts
import type {
  RequestStatus,
  DeliveryStatus,
  VerificationStatus,
  SendVerificationMessageParams,
  CheckSendAbilityParams,
  CheckVerificationStatusParams,
  RevokeVerificationMessageParams,
  CallbackReport,
} from "@deployed/telegram-gateway";
```

## Resources

- [Telegram Gateway Overview](https://core.telegram.org/gateway)
- [API Reference](https://core.telegram.org/gateway/api)
- [Quick-start Tutorial](https://core.telegram.org/gateway/verification-tutorial)

## License

MIT
