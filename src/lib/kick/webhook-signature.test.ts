import { describe, expect, it } from "vitest";

import {
  KICK_WEBHOOK_PUBLIC_KEY_PEM,
  importWebhookPublicKey,
  verifyWebhookSignature,
} from "./webhook-signature";
import type { WebhookSignatureInput } from "./webhook-signature";

// Tests generate their own RSA keypair and sign a fixture delivery — no
// network, no dependence on KICK's real private key.

const RSA_PARAMS = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
} as const;

async function generateKeypair() {
  return crypto.subtle.generateKey(RSA_PARAMS, true, ["sign", "verify"]);
}

async function publicKeyToPem(key: CryptoKey): Promise<string> {
  const der = new Uint8Array(await crypto.subtle.exportKey("spki", key));
  let binary = "";
  for (const b of der) binary += String.fromCharCode(b);
  const base64 = btoa(binary).replace(/(.{64})/g, "$1\n").trimEnd();
  return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
}

async function signDelivery(
  privateKey: CryptoKey,
  delivery: Omit<WebhookSignatureInput, "signature">,
): Promise<string> {
  const data = new TextEncoder().encode(
    `${delivery.messageId}.${delivery.timestamp}.${delivery.rawBody}`,
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, data);
  let binary = "";
  for (const b of new Uint8Array(signature)) binary += String.fromCharCode(b);
  return btoa(binary);
}

const DELIVERY = {
  messageId: "01JXH0000000000000000000000",
  timestamp: "2025-01-01T00:00:00Z",
  rawBody: JSON.stringify({ content: "hello chat", message_id: "m-1" }),
};

describe("verifyWebhookSignature", () => {
  it("accepts a signature made over {message-id}.{timestamp}.{raw-body}", async () => {
    const { privateKey, publicKey } = await generateKeypair();
    const signature = await signDelivery(privateKey, DELIVERY);
    const pem = await publicKeyToPem(publicKey);

    await expect(verifyWebhookSignature({ ...DELIVERY, signature }, pem)).resolves.toBe(true);
  });

  it("rejects when the body was tampered with", async () => {
    const { privateKey, publicKey } = await generateKeypair();
    const signature = await signDelivery(privateKey, DELIVERY);
    const pem = await publicKeyToPem(publicKey);

    await expect(
      verifyWebhookSignature({ ...DELIVERY, rawBody: DELIVERY.rawBody + " ", signature }, pem),
    ).resolves.toBe(false);
  });

  it("rejects a signature from a different key", async () => {
    const attacker = await generateKeypair();
    const { publicKey } = await generateKeypair();
    const signature = await signDelivery(attacker.privateKey, DELIVERY);
    const pem = await publicKeyToPem(publicKey);

    await expect(verifyWebhookSignature({ ...DELIVERY, signature }, pem)).resolves.toBe(false);
  });

  it("rejects malformed signature material without throwing", async () => {
    const { publicKey } = await generateKeypair();
    const pem = await publicKeyToPem(publicKey);

    await expect(
      verifyWebhookSignature({ ...DELIVERY, signature: "%%%not-base64%%%" }, pem),
    ).resolves.toBe(false);
  });

  it("rejects a malformed public key PEM without throwing", async () => {
    await expect(
      verifyWebhookSignature({ ...DELIVERY, signature: "AAAA" }, "-----BEGIN PUBLIC KEY-----\ngarbage\n-----END PUBLIC KEY-----"),
    ).resolves.toBe(false);
  });
});

describe("KICK_WEBHOOK_PUBLIC_KEY_PEM", () => {
  it("is importable as an RSASSA-PKCS1-v1_5 SPKI public key", async () => {
    const key = await importWebhookPublicKey(KICK_WEBHOOK_PUBLIC_KEY_PEM);
    expect(key.type).toBe("public");
    expect(key.usages).toContain("verify");
  });
});
