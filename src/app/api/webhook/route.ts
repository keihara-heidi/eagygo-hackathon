/**
 * POST /api/webhook — live KICK webhook receiver.
 *
 * Thin adapter over the chat engine's sole ingress: verify the RSA-SHA256
 * signature over `{message-id}.{timestamp}.{raw-body}` (see
 * src/lib/kick/webhook-signature.ts), dedupe on Kick-Event-Message-Id, then
 * `publish`. Responds fast and always 2xx for signed-but-unusable deliveries
 * (duplicates, unknown event types) — KICK retries on non-2xx and disables
 * webhooks that keep failing, so log instead of erroring.
 *
 * Register the deployed URL under "Enable Webhooks" in the KICK dev app
 * settings, then create subscriptions via `bun scripts/kick-webhooks.ts`.
 */

import { getChatEngine } from "@/lib/chat-engine/engine";
import { isKickEventType } from "@/lib/kick/events";
import { verifyWebhookSignature } from "@/lib/kick/webhook-signature";

// In-memory dedupe of Kick-Event-Message-Id. Per-instance only: on
// serverless/multi-instance deploys, each instance keeps its own window, so
// cross-instance retries may slip through. Fine for this app — the engine
// buffer is per-instance too.
const MAX_SEEN = 2_048;
const seenMessageIds = new Set<string>();
const seenOrder: string[] = [];

function isDuplicate(messageId: string): boolean {
  if (seenMessageIds.has(messageId)) return true;
  seenMessageIds.add(messageId);
  seenOrder.push(messageId);
  if (seenOrder.length > MAX_SEEN) {
    const oldest = seenOrder.shift();
    if (oldest !== undefined) seenMessageIds.delete(oldest);
  }
  return false;
}

export async function POST(request: Request) {
  const messageId = request.headers.get("Kick-Event-Message-Id");
  const timestamp = request.headers.get("Kick-Event-Message-Timestamp");
  const signature = request.headers.get("Kick-Event-Signature");
  const eventType = request.headers.get("Kick-Event-Type");
  const versionHeader = request.headers.get("Kick-Event-Version");

  if (!messageId || !timestamp || !signature || !eventType) {
    console.warn("[webhook] missing headers", {
      hasMessageId: Boolean(messageId),
      hasTimestamp: Boolean(timestamp),
      hasSignature: Boolean(signature),
      eventType,
    });
    return Response.json({ error: "missing Kick-Event-* headers" }, { status: 400 });
  }

  console.info("[webhook] received", { messageId, eventType, versionHeader });

  // Raw text before JSON.parse — the signature covers the exact bytes sent.
  const rawBody = await request.text();
  const valid = await verifyWebhookSignature({ messageId, timestamp, rawBody, signature });
  if (!valid) {
    console.warn("[webhook] invalid signature", { messageId, eventType });
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  if (isDuplicate(messageId)) {
    console.info("[webhook] duplicate ignored", { messageId, eventType });
    return Response.json({ ok: true, duplicate: true });
  }

  if (!isKickEventType(eventType)) {
    console.warn(`[webhook] ignoring unknown Kick-Event-Type: ${eventType}`);
    return Response.json({ ok: true, ignored: true });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.warn(`[webhook] ignoring unparseable body for message ${messageId}`);
    return Response.json({ ok: true, ignored: true });
  }

  const eventVersion = versionHeader === null ? undefined : Number(versionHeader);
  const stamped = getChatEngine().publish({
    eventType,
    ...(eventVersion !== undefined && !Number.isNaN(eventVersion) ? { eventVersion } : {}),
    body,
  });
  console.info("[webhook] published", {
    messageId,
    eventType,
    seq: stamped.seq,
    broadcasterUserId: stamped.event.payload.broadcaster.user_id,
  });

  return Response.json({ ok: true });
}
