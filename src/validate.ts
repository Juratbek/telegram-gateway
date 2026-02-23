const E164_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * Validates that the given string is a phone number in E.164 format.
 *
 * E.164 requires a leading `+`, a non-zero country code digit, and up to
 * 14 additional digits (15 digits max). Throws if the format is invalid.
 *
 * @example "+998901234567"
 */
export function assertE164(phone: string): void {
  if (!E164_REGEX.test(phone)) {
    throw new Error(
      `Invalid phone number "${phone}". Expected E.164 format (e.g. "+998901234567").`,
    );
  }
}
