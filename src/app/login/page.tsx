import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import {
  TypographyH1,
  TypographyLead,
  TypographyMuted,
  TypographySmall,
} from "@/components/ui/typography";
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
    <main className="relative isolate flex min-h-screen items-center overflow-hidden px-6 py-8 sm:px-10 lg:px-16">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(83,252,24,0.2),transparent_36%),linear-gradient(135deg,#0b0b0c_0%,#171a1c_52%,#0b0b0c_100%)]"
      />

      <section className="mx-auto w-full max-w-xl rounded-2xl border bg-card/90 p-8 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-12">
        <header className="mb-16 flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="size-2.5 bg-primary" />
          Easygo Mini Hackathon · Challenge 02
        </header>

        <TypographySmall className="mb-5 block font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          KICK account required
        </TypographySmall>
        <TypographyH1 className="text-5xl leading-[0.9] font-bold uppercase sm:text-6xl">
          Chat insights
          <span className="block text-primary">starts here</span>
        </TypographyH1>
        <TypographyLead className="mt-8 text-lg leading-8">
          Log in with KICK to open the app. No separate account or password is needed.
        </TypographyLead>

        <div className="mt-10">
          {configured ? (
            <a
              className={buttonVariants({
                className: "h-11 px-6 uppercase tracking-[0.12em]",
              })}
              href="/api/auth/login"
            >
              Log in with KICK
            </a>
          ) : (
            <span
              aria-disabled="true"
              className={buttonVariants({
                className: "h-11 cursor-not-allowed px-6 uppercase tracking-[0.12em] opacity-50",
              })}
            >
              Log in with KICK
            </span>
          )}
        </div>

        {(message || !configured) && (
          <TypographyMuted className="mt-5 text-sm text-destructive" role="alert">
            {message ?? "Set the KICK OAuth environment variables to enable sign-in."}
          </TypographyMuted>
        )}
      </section>
    </main>
  );
}
