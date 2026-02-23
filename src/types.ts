// ── Delivery & Verification Statuses ────────────────────────────────

/**
 * Delivery status of a verification message.
 *
 * - `"sent"` — message has been sent to the recipient
 * - `"delivered"` — message was delivered to the recipient's device
 * - `"read"` — recipient opened/read the message
 * - `"expired"` — message was not delivered within the TTL window
 * - `"revoked"` — message was revoked via {@link RevokeVerificationMessageParams}
 *
 * @see https://core.telegram.org/gateway/api#requeststatus
 */
export type DeliveryStatusValue =
  | "sent"
  | "delivered"
  | "read"
  | "expired"
  | "revoked";

/**
 * Verification status of the code entered by the user.
 *
 * - `"code_valid"` — the user entered the correct code
 * - `"code_invalid"` — the user entered an incorrect code
 * - `"code_max_attempts_exceeded"` — too many incorrect attempts; the code is now blocked
 * - `"expired"` — the code has expired and can no longer be used
 *
 * @see https://core.telegram.org/gateway/api#requeststatus
 */
export type VerificationStatusValue =
  | "code_valid"
  | "code_invalid"
  | "code_max_attempts_exceeded"
  | "expired";

/**
 * Delivery status of a previously sent verification message.
 *
 * @see https://core.telegram.org/gateway/api#requeststatus
 */
export interface DeliveryStatus {
  /** Current delivery status of the message. */
  status: DeliveryStatusValue;
  /** Unix timestamp (seconds) of the last status update. */
  updated_at: number;
}

/**
 * Verification status for a code that Telegram generated (via `code_length`).
 * Returned after calling `checkVerificationStatus` with a user-entered `code`.
 *
 * @see https://core.telegram.org/gateway/api#requeststatus
 */
export interface VerificationStatus {
  /** Current verification status of the code. */
  status: VerificationStatusValue;
  /** Unix timestamp (seconds) of the last status update. */
  updated_at: number;
  /** The code the user entered, if one was submitted for validation. */
  code_entered?: string;
}

// ── RequestStatus (returned by all methods) ─────────────────────────

/**
 * Status object returned by most Telegram Gateway API methods.
 * Contains request metadata, cost info, and optional delivery/verification status.
 *
 * @see https://core.telegram.org/gateway/api#requeststatus
 */
export interface RequestStatus {
  /** Unique identifier for this verification request. Use this to check status or revoke. */
  request_id: string;
  /** Phone number the message was sent to, in E.164 format (e.g. `"+998901234567"`). */
  phone_number: string;
  /** Cost charged for this request (in Telegram Stars). */
  request_cost: number;
  /** `true` if the fee was refunded (e.g. message expired before delivery). */
  is_refunded?: boolean;
  /** Remaining account balance after this request (in Telegram Stars). */
  remaining_balance?: number;
  /** Delivery status of the message, if available. */
  delivery_status?: DeliveryStatus;
  /** Verification status of the code, if a code was submitted via `checkVerificationStatus`. */
  verification_status?: VerificationStatus;
  /** Custom payload string passed in the original `sendVerificationMessage` call. Not shown to the user. */
  payload?: string;
}

// ── Method Parameters ───────────────────────────────────────────────

/**
 * Parameters for `sendVerificationMessage`.
 * Sends a verification code to the given phone number via Telegram.
 *
 * @see https://core.telegram.org/gateway/api#sendverificationmessage
 */
export interface SendVerificationMessageParams {
  /** Phone number in E.164 format (e.g. `"+998901234567"`). Must include the leading `+`. */
  phone_number: string;
  /** Request ID from a previous `checkSendAbility` call. Pass this to avoid a double charge. */
  request_id?: string;
  /** Username of a verified Telegram channel owned by you. Shown as the message sender. */
  sender_username?: string;
  /** Your own verification code (4–8 alphanumeric characters). If set, `code_length` is ignored. */
  code?: string;
  /** Length of the code for Telegram to auto-generate (4–8). Only used when `code` is not provided. */
  code_length?: number;
  /** HTTPS URL to receive delivery report callbacks (max 256 bytes). */
  callback_url?: string;
  /** Custom internal payload, not shown to the user (max 128 bytes). Returned in `RequestStatus`. */
  payload?: string;
  /** Time-to-live in seconds (30–3600). Defaults to 120. If undelivered within this window, the fee is refunded. */
  ttl?: number;
}

/**
 * Parameters for `checkSendAbility`.
 * Checks whether a verification message can be delivered before sending.
 *
 * @see https://core.telegram.org/gateway/api#checksendability
 */
export interface CheckSendAbilityParams {
  /** Phone number in E.164 format (e.g. `"+998901234567"`). Must include the leading `+`. */
  phone_number: string;
}

/**
 * Parameters for `checkVerificationStatus`.
 * Checks delivery status and optionally validates the user-entered code.
 *
 * @see https://core.telegram.org/gateway/api#checkverificationstatus
 */
export interface CheckVerificationStatusParams {
  /** Request ID returned by `sendVerificationMessage`. */
  request_id: string;
  /** The code entered by the user. If provided, Telegram validates it server-side. */
  code?: string;
}

/**
 * Parameters for `revokeVerificationMessage`.
 * Revokes (deletes) a previously sent verification message. Best-effort — may not
 * prevent delivery if the message was already read.
 *
 * @see https://core.telegram.org/gateway/api#revokeverificationmessage
 */
export interface RevokeVerificationMessageParams {
  /** Request ID returned by `sendVerificationMessage`. */
  request_id: string;
}

// ── API Response Envelope ───────────────────────────────────────────

/** Successful API response wrapper. */
export interface ApiResponseSuccess<T> {
  ok: true;
  result: T;
}

/** Failed API response wrapper. */
export interface ApiResponseError {
  ok: false;
  /** Error code string (e.g. `"PHONE_NUMBER_INVALID"`, `"ACCESS_TOKEN_INVALID"`). */
  error: string;
}

/** Discriminated union of success/error API responses. */
export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;

// ── checkSendAbility Result ──────────────────────────────────────────

/** Successful result from `checkSendAbility` — the number can receive messages. */
export interface SendAbilitySuccess {
  ok: true;
  /** Status object containing `request_id` to pass to `sendVerificationMessage`. */
  result: RequestStatus;
}

/** Failed result from `checkSendAbility` — the number cannot receive messages. No fee charged. */
export interface SendAbilityFailure {
  ok: false;
  /** Error code string describing why the message cannot be delivered. */
  error: string;
}

/**
 * Return type of `checkSendAbility`. Discriminated union — check `ok` to narrow.
 *
 * @example
 * ```ts
 * const result = await gateway.checkSendAbility({ phone_number: "+998901234567" });
 * if (result.ok) {
 *   // result.result.request_id is available
 * } else {
 *   // result.error describes why delivery is not possible
 * }
 * ```
 */
export type SendAbilityResult = SendAbilitySuccess | SendAbilityFailure;

// ── Callback Report ─────────────────────────────────────────────────

/**
 * Data needed to verify the integrity of a delivery report callback from Telegram.
 * Extract these values from the incoming HTTP request headers and body.
 *
 * @see https://core.telegram.org/gateway/api#checking-report-integrity
 */
export interface CallbackReport {
  /** Value of the `X-Request-Timestamp` header (Unix timestamp in seconds, as a string). */
  timestamp: string;
  /** Value of the `X-Request-Signature` header (HMAC-SHA256 hex digest). */
  signature: string;
  /** The raw POST body as a string. Must not be re-serialized — pass the original string. */
  body: string;
}

// ── Client Options ──────────────────────────────────────────────────

/**
 * Options for the {@link TelegramGateway} client constructor.
 */
export interface TelegramGatewayOptions {
  /** API access token from gateway.telegram.org */
  accessToken: string;
  /** Base URL override (useful for testing). Defaults to `"https://gatewayapi.telegram.org"`. */
  baseUrl?: string;
  /** Custom `fetch` implementation (e.g. for Node 16 polyfill or testing). */
  fetch?: typeof fetch;
}
