import "server-only";

import { createKickClient } from "@/lib/kick/client";
import { createOAuthClient } from "@/lib/kick/oauth";

export async function createKickAppClient() {
  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("KICK_CLIENT_ID and KICK_CLIENT_SECRET are required");
  }

  const token = await createOAuthClient({ clientId, clientSecret }).clientCredentials();
  return createKickClient({ token: token.access_token });
}
