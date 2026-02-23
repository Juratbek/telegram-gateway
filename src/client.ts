import { TelegramGatewayError } from "./errors";
import type {
  ApiResponse,
  CheckSendAbilityParams,
  CheckVerificationStatusParams,
  RequestStatus,
  RevokeVerificationMessageParams,
  SendAbilityResult,
  SendVerificationMessageParams,
  TelegramGatewayOptions,
} from "./types";
import { assertE164 } from "./validate";

const DEFAULT_BASE_URL = "https://gatewayapi.telegram.org";

/**
 * Client for the Telegram Gateway API.
 * Provides methods to send verification codes via Telegram, check delivery status,
 * validate user-entered codes, and revoke messages.
 *
 * @example
 * ```ts
 * const gateway = new TelegramGateway({ accessToken: "your-token" });
 * const status = await gateway.sendVerificationMessage({
 *   phone_number: "+998901234567",
 *   code_length: 6,
 * });
 * ```
 *
 * @see https://core.telegram.org/gateway/api
 */
export class TelegramGateway {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly _fetch: typeof fetch;

  /**
   * @param options - Client configuration. `accessToken` is required.
   * @throws {Error} If `accessToken` is not provided.
   */
  constructor(options: TelegramGatewayOptions) {
    if (!options.accessToken) {
      throw new Error("accessToken is required");
    }

    this.accessToken = options.accessToken;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this._fetch = options.fetch ?? fetch;
  }

  private async request<T>(method: string, params?: object): Promise<T> {
    const body = params ? JSON.stringify(params) : undefined;

    const response = await this._fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body,
    });

    const data = (await response.json()) as ApiResponse<T>;

    if (!data.ok) {
      throw new TelegramGatewayError(data.error, data.error);
    }

    return data.result;
  }

  /**
   * Send a verification message to the specified phone number.
   *
   * Charges apply per successful delivery. Free when sending to your own number.
   * Supply a `request_id` from {@link checkSendAbility} to avoid a double charge.
   *
   * @param params - Phone number and optional code/delivery settings.
   * @returns The {@link RequestStatus} with `request_id`, cost, and delivery info.
   * @throws {TelegramGatewayError} On API errors (e.g. `PHONE_NUMBER_INVALID`, `BALANCE_TOO_LOW`).
   *
   * @example
   * ```ts
   * const status = await gateway.sendVerificationMessage({
   *   phone_number: "+998901234567",
   *   code_length: 6,
   *   ttl: 300,
   * });
   * console.log(status.request_id);
   * ```
   *
   * @see https://core.telegram.org/gateway/api#sendverificationmessage
   */
  async sendVerificationMessage(params: SendVerificationMessageParams): Promise<RequestStatus> {
    assertE164(params.phone_number);
    return this.request<RequestStatus>("sendVerificationMessage", {
      ...params,
      ttl: params.ttl ?? 120,
    });
  }

  /**
   * Check whether a verification message can be delivered to the given phone number.
   *
   * Returns `{ ok: true, result }` with a `RequestStatus` on success, or
   * `{ ok: false, error }` if the message cannot be delivered.
   * Unlike other methods, this never throws on API errors — it returns a discriminated union instead.
   *
   * If confirmed, pass `result.request_id` to {@link sendVerificationMessage}
   * so that the subsequent send is free of charge (only one fee total).
   *
   * @param params - The phone number to check.
   * @returns A {@link SendAbilityResult} — check `result.ok` to discriminate success/failure.
   *
   * @example
   * ```ts
   * const check = await gateway.checkSendAbility({ phone_number: "+998901234567" });
   * if (check.ok) {
   *   await gateway.sendVerificationMessage({
   *     phone_number: "+998901234567",
   *     request_id: check.result.request_id, // makes this call free
   *     code_length: 6,
   *   });
   * } else {
   *   console.log("Cannot deliver:", check.error);
   * }
   * ```
   *
   * @see https://core.telegram.org/gateway/api#checksendability
   */
  async checkSendAbility(params: CheckSendAbilityParams): Promise<SendAbilityResult> {
    assertE164(params.phone_number);

    const response = await this._fetch(`${this.baseUrl}/checkSendAbility`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const data = (await response.json()) as ApiResponse<RequestStatus>;

    if (!data.ok) {
      return { ok: false, error: data.error };
    }

    return { ok: true, result: data.result };
  }

  /**
   * Check the delivery / verification status of a previously sent message.
   *
   * Optionally pass the user-entered `code` to let Telegram validate it when
   * the code was auto-generated (i.e. you used `code_length` instead of `code`).
   * This method is always free — no fee is charged.
   *
   * @param params - The `request_id` and optionally the user-entered `code`.
   * @returns The {@link RequestStatus} with current `delivery_status` and `verification_status`.
   * @throws {TelegramGatewayError} On API errors (e.g. `REQUEST_ID_INVALID`).
   *
   * @example
   * ```ts
   * const status = await gateway.checkVerificationStatus({
   *   request_id: "abc123",
   *   code: "123456",
   * });
   * if (status.verification_status?.status === "code_valid") {
   *   // user entered the correct code
   * }
   * ```
   *
   * @see https://core.telegram.org/gateway/api#checkverificationstatus
   */
  async checkVerificationStatus(params: CheckVerificationStatusParams): Promise<RequestStatus> {
    return this.request<RequestStatus>("checkVerificationStatus", params);
  }

  /**
   * Revoke a previously sent verification message.
   *
   * Returns `true` if the revocation was accepted. Best-effort — delivery is not
   * guaranteed to be prevented if the message was already delivered or read.
   * This method is always free — no fee is charged.
   *
   * @param params - The `request_id` of the message to revoke.
   * @returns `true` if the server accepted the revocation.
   * @throws {TelegramGatewayError} On API errors (e.g. `REQUEST_ID_INVALID`).
   *
   * @example
   * ```ts
   * await gateway.revokeVerificationMessage({ request_id: "abc123" });
   * ```
   *
   * @see https://core.telegram.org/gateway/api#revokeverificationmessage
   */
  async revokeVerificationMessage(params: RevokeVerificationMessageParams): Promise<true> {
    return this.request<true>("revokeVerificationMessage", params);
  }
}
