import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ViewerChat } from "@/components/viewer-chat";
import { getKickSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Viewer Chat · Sidekick",
  description: "Ask Sidekick about the KICK stream and recent chat.",
};

export default async function ChatPage() {
  const session = await getKickSession();
  if (!session) redirect("/login");

  return <ViewerChat username={session.user.name} />;
}
