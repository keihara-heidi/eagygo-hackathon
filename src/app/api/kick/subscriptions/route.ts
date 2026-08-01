import { getKickSubscriptionState } from "@/lib/sidekick/kick-connect";

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

export async function GET() {
  const deps = credentials();
  if (!deps) return credentialsError();

  try {
    console.info("[kick-subscriptions] list requested");
    const state = await getKickSubscriptionState(deps);
    return Response.json(state);
  } catch (error) {
    console.error("[kick-subscriptions] list failed", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "KICK subscription list failed" },
      { status: 502 },
    );
  }
}
