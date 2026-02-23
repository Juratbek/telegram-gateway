export { TelegramGateway } from "./client";
export { TelegramGatewayError } from "./errors";
export { verifyCallbackSignature } from "./verify-signature";
export type {
  TelegramGatewayOptions,
  SendVerificationMessageParams,
  CheckSendAbilityParams,
  CheckVerificationStatusParams,
  RevokeVerificationMessageParams,
  RequestStatus,
  DeliveryStatus,
  DeliveryStatusValue,
  VerificationStatus,
  VerificationStatusValue,
  ApiResponse,
  ApiResponseSuccess,
  ApiResponseError,
  SendAbilityResult,
  SendAbilitySuccess,
  SendAbilityFailure,
  CallbackReport,
} from "./types";
