import { disconnectKickChannel } from "@/lib/sidekick/kick-connect";

export const dynamic = "force-dynamic";

function credentials() {
  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function credentialsError() {
  return Response.json(
    { error: "KICK app credentials not configured (KICK_CLIENT_ID / KICK_CLIENT_SECRET)" },
    { status: 503 },
  );
}

async function resetSubscriptions() {
  const deps = credentials();
  if (!deps) return credentialsError();

  try {
    console.info("[kick-subscriptions-reset] reset requested");
    const { deleted } = await disconnectKickChannel(deps);
    console.info("[kick-subscriptions-reset] reset complete", { deleted });
    return Response.json({ ok: true, deleted });
  } catch (error) {
    console.error("[kick-subscriptions-reset] reset failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "KICK subscription reset failed" },
      { status: 502 },
    );
  }
}

export async function POST() {
  return resetSubscriptions();
}

export async function DELETE() {
  return resetSubscriptions();
}
