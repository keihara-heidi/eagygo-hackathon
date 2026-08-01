/**
 * Loopback implementation of the bot-posting seam. Where production would
 * call `POST /public/v1/chat` and later receive the message back as a
 * `chat.message.sent` webhook, this adapter synthesizes that webhook delivery
 * immediately and hands it straight back to the engine's ingress.
 */

import type { ChatMessageReply, WebhookDelivery } from "@/lib/kick/events";
import type { ChatMessageEvent } from "@/lib/kick/events";

import { SIDEKICK_BOT } from "./cast";
import { chatMessageDelivery } from "./deliveries";
import type { BotPoster } from "./types";

export interface LoopbackBotPosterDeps {
  /** The engine's `publish` — the synthesized webhook echo enters here. */
  deliver: (delivery: WebhookDelivery) => void;
  /** Buffer lookup used to hydrate `replies_to`, as KICK's servers would. */
  lookupMessage: (message_id: string) => ChatMessageEvent | undefined;
  clock: () => Date;
}

export function createLoopbackBotPoster(deps: LoopbackBotPosterDeps): BotPoster {
  return {
    post(params) {
      const message_id = crypto.randomUUID();

      let replies_to: ChatMessageReply | undefined;
      if (params.reply_to_message_id !== undefined) {
        const parent = deps.lookupMessage(params.reply_to_message_id);
        if (parent) {
          replies_to = {
            message_id: parent.message_id,
            content: parent.content,
            sender: parent.sender,
          };
        }
      }

      deps.deliver(
        chatMessageDelivery(
          {
            sender: SIDEKICK_BOT,
            text: params.content,
            message_id,
            ...(replies_to ? { replies_to } : {}),
          },
          deps.clock(),
        ),
      );

      return Promise.resolve({ is_sent: true, message_id });
    },
  };
}
