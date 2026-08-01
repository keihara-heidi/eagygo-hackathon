/**
 * Webhook sender validation, mirroring
 * https://docs.kick.com/events/webhook-security.
 *
 * KICK signs every delivery with its private key over the concatenation
 * `{Kick-Event-Message-Id}.{Kick-Event-Message-Timestamp}.{raw-body}` using
 * RSA-SHA256 (PKCS#1 v1.5), and sends the signature base64-encoded in the
 * `Kick-Event-Signature` header. Verify against KICK's published public key
 * before trusting (or JSON-parsing) any webhook body.
 */

/**
 * KICK's webhook public key, copied verbatim from
 * https://docs.kick.com/events/webhook-security ("Kick Public Key").
 * The same key is served at runtime by `GET /public/v1/public-key`
 * (`createKickClient(...).publicKey()`) if it ever rotates.
 */
export const KICK_WEBHOOK_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;

export interface WebhookSignatureInput {
  /** Value of the Kick-Event-Message-Id header. */
  messageId: string;
  /** Value of the Kick-Event-Message-Timestamp header. */
  timestamp: string;
  /** Raw request body text, exactly as received (before JSON.parse). */
  rawBody: string;
  /** Value of the Kick-Event-Signature header (base64). */
  signature: string;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s+/g, "");
  return base64ToBytes(body);
}

export async function importWebhookPublicKey(
  pem: string = KICK_WEBHOOK_PUBLIC_KEY_PEM,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    pemToDer(pem) as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

/**
 * Returns true iff `signature` is a valid KICK signature for the delivery.
 * Never throws: malformed PEM, base64, or signature material verifies false.
 */
export async function verifyWebhookSignature(
  input: WebhookSignatureInput,
  publicKeyPem: string = KICK_WEBHOOK_PUBLIC_KEY_PEM,
): Promise<boolean> {
  try {
    const key = await importWebhookPublicKey(publicKeyPem);
    const signedData = new TextEncoder().encode(
      `${input.messageId}.${input.timestamp}.${input.rawBody}`,
    );
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64ToBytes(input.signature) as BufferSource,
      signedData,
    );
  } catch {
    return false;
  }
}
