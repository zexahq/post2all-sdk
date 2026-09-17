import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhookSignature(input: {
  rawBody: string;
  secret: string;
  eventId: string;
  timestamp: string;
  signature: string;
  toleranceSeconds?: number;
  now?: Date;
}): boolean {
  const timestamp = Number(input.timestamp);
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  if (
    !Number.isInteger(timestamp) ||
    Math.abs((input.now ?? new Date()).getTime() / 1000 - timestamp) >
      toleranceSeconds
  ) {
    return false;
  }

  const expected = `v1=${createHmac("sha256", input.secret)
    .update(`${input.eventId}.${input.timestamp}.${input.rawBody}`)
    .digest("hex")}`;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(input.signature);
  return (
    expectedBytes.length === actualBytes.length &&
    timingSafeEqual(expectedBytes, actualBytes)
  );
}
