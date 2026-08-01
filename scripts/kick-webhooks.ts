/**
 * KICK webhook subscription bootstrap. Uses an app access token (client
 * credentials) so it can subscribe to any broadcaster's events.
 *
 * Run: bun run scripts/kick-webhooks.ts <create|list|delete> [args]
 *   create [--broadcaster <user_id>]   subscribe to all event types (v1)
 *   list   [--broadcaster <user_id>]   show current subscriptions
 *   delete <id...> | --all             remove subscriptions
 *
 * Env: KICK_CLIENT_ID, KICK_CLIENT_SECRET (required);
 *      KICK_BROADCASTER_USER_ID (default for --broadcaster).
 */

import { createKickClient } from "../src/lib/kick/client";
import { KICK_EVENT_TYPES } from "../src/lib/kick/events";
import { createOAuthClient } from "../src/lib/kick/oauth";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  let broadcaster: number | undefined;
  let all = false;
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--broadcaster") {
      const value = rest[i + 1];
      if (!value) fail("--broadcaster requires a user_id");
      broadcaster = Number(value);
      i += 1;
    } else if (arg === "--all") {
      all = true;
    } else if (arg !== undefined) {
      positional.push(arg);
    }
  }
  if (broadcaster === undefined && process.env.KICK_BROADCASTER_USER_ID) {
    broadcaster = Number(process.env.KICK_BROADCASTER_USER_ID);
  }
  if (broadcaster !== undefined && Number.isNaN(broadcaster)) {
    fail("broadcaster user_id must be a number");
  }
  return { command, broadcaster, all, positional };
}

async function main() {
  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    fail("KICK_CLIENT_ID and KICK_CLIENT_SECRET must be set (.env.local)");
  }

  const { command, broadcaster, all, positional } = parseArgs(process.argv.slice(2));

  const token = await createOAuthClient({ clientId, clientSecret }).clientCredentials();
  const client = createKickClient({ token: token.access_token });

  switch (command) {
    case "create": {
      const events = KICK_EVENT_TYPES.map((name) => ({ name, version: 1 }));
      const results = await client.events.subscriptions.create({
        events,
        ...(broadcaster !== undefined ? { broadcaster_user_id: broadcaster } : {}),
      });
      console.log(
        `Requested ${events.length} subscriptions` +
          (broadcaster !== undefined ? ` for broadcaster ${broadcaster}` : "") +
          ":",
      );
      for (const result of results) {
        if (result.error) {
          console.log(`  FAIL ${result.name} v${result.version}: ${result.error}`);
        } else {
          console.log(`  ok   ${result.name} v${result.version} -> ${result.subscription_id}`);
        }
      }
      break;
    }

    case "list": {
      const subscriptions = await client.events.subscriptions.list(
        broadcaster !== undefined ? { broadcaster_user_id: broadcaster } : undefined,
      );
      if (subscriptions.length === 0) {
        console.log("No subscriptions.");
        break;
      }
      for (const sub of subscriptions) {
        console.log(
          `  ${sub.id}  ${sub.event} v${sub.version}  broadcaster=${sub.broadcaster_user_id}  method=${sub.method}  created=${sub.created_at}`,
        );
      }
      break;
    }

    case "delete": {
      let ids = positional;
      if (all) {
        const subscriptions = await client.events.subscriptions.list(
          broadcaster !== undefined ? { broadcaster_user_id: broadcaster } : undefined,
        );
        ids = subscriptions.map((sub) => sub.id);
      }
      if (ids.length === 0) {
        fail("delete requires subscription ids or --all");
      }
      await client.events.subscriptions.delete(ids);
      console.log(`Deleted ${ids.length} subscription(s): ${ids.join(", ")}`);
      break;
    }

    default:
      fail("Usage: bun run scripts/kick-webhooks.ts <create|list|delete> [--broadcaster <user_id>] [--all] [id...]");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
