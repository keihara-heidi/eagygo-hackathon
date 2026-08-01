import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import {
  getKickSession,
  isKickAuthConfigured,
} from "@/lib/auth/session";

const errorMessages: Record<string, string> = {
  access_denied: "KICK sign-in was cancelled.",
  invalid_callback: "We could not verify that KICK sign-in. Please try again.",
  not_configured: "KICK OAuth is not configured for this deployment.",
  oauth_failed: "KICK sign-in failed. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const configured = isKickAuthConfigured();
  if (configured && (await getKickSession())) redirect("/");

  const errorValue = (await searchParams).error;
  const error = Array.isArray(errorValue) ? errorValue[0] : errorValue;
  const message = error ? errorMessages[error] : undefined;

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="shrink-0 border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
          <span className="font-brand text-2xl leading-none text-primary">KICK</span>
          <span aria-hidden="true" className="mx-3 h-5 w-px bg-border" />
          <span className="text-sm font-semibold">Sidekick</span>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <section className="w-full max-w-[440px] rounded-lg bg-card p-6 shadow-lg shadow-black/30 ring-1 ring-border">
          <header className="border-b pb-4">
            <p className="text-sm font-semibold text-primary">Sign in</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Continue to Sidekick</h1>
          </header>

          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            Use your KICK account to open the live stream copilot. No separate account or
            password is needed.
          </p>

          {configured ? (
            <a
              className={buttonVariants({
                className: "mt-6 h-10 w-full px-4",
              })}
              href="/api/auth/login"
            >
              Log in with KICK
            </a>
          ) : (
            <span
              aria-disabled="true"
              className={buttonVariants({
                className: "mt-6 h-10 w-full cursor-not-allowed px-4 opacity-50",
              })}
            >
              Log in with KICK
            </span>
          )}

          {(message || !configured) && (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {message ?? "Set the KICK OAuth environment variables to enable sign-in."}
            </p>
          )}

          <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">
            Easygo Mini Hackathon · Challenge 02
          </p>
        </section>
      </div>
    </main>
  );
}
