export class TelegramGatewayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "TelegramGatewayError";
  }
}
