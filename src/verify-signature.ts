import { createHmac, createHash } from "crypto";
import type { CallbackReport } from "./types";

/**
 * Verify the integrity of a delivery report received at your callback URL.
 *
 * Compares the `X-Request-Signature` header against an HMAC-SHA256 of
 * `"<timestamp>\n<body>"` keyed with `SHA256(apiToken)`. Also rejects requests
 * where the timestamp is older than `maxAgeSeconds` to prevent replay attacks.
 *
 * **Important:** Pass the raw request body as a string — do not parse and re-serialize
 * JSON, as whitespace/key-order changes will invalidate the signature.
 *
 * @param apiToken - Your Telegram Gateway API token (same one used to create the client).
 * @param report - Object with `timestamp`, `signature`, and `body` from the incoming request.
 * @param maxAgeSeconds - Maximum allowed age of the timestamp in seconds. Defaults to `300` (5 minutes).
 * @returns `true` if the signature is valid and the timestamp is within the allowed window.
 *
 * @example
 * ```ts
 * import { verifyCallbackSignature } from "@deployed/telegram-gateway";
 *
 * const isValid = verifyCallbackSignature(process.env.TG_GATEWAY_TOKEN!, {
 *   timestamp: req.headers["x-request-timestamp"],
 *   signature: req.headers["x-request-signature"],
 *   body: rawBody,
 * });
 * ```
 *
 * @see https://core.telegram.org/gateway/api#checking-report-integrity
 */
export function verifyCallbackSignature(
  apiToken: string,
  report: CallbackReport,
  maxAgeSeconds = 300,
): boolean {
  const ts = Number(report.timestamp);
  if (Number.isNaN(ts)) return false;

  const age = Math.abs(Date.now() / 1000 - ts);
  if (age > maxAgeSeconds) return false;

  const secretKey = createHash("sha256").update(apiToken).digest();
  const dataCheckString = `${report.timestamp}\n${report.body}`;
  const expected = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return expected === report.signature;
}
