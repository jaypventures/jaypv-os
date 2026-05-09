import crypto from "node:crypto";

export function verifySignature({ rawBody, signature, secret }) {
  if (!secret || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}

export function createSignature(rawBody, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
}
