import {
  TypographyH1,
  TypographyLead,
  TypographyMuted,
  TypographySmall,
} from "@/components/ui/typography";

const stack = [
  "Next.js",
  "Jotai",
  "TanStack Query",
  "TanStack Form",
  "shadcn/ui",
];

export default function Home() {
  return (
    <main className="relative isolate flex min-h-screen overflow-hidden px-6 py-8 sm:px-10 lg:px-16 lg:py-16">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(83,252,24,0.16),transparent_36%),linear-gradient(135deg,#0b0b0c_0%,#171a1c_52%,#0b0b0c_100%)]"
      />

      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-between gap-16 rounded-2xl border bg-card/80 p-8 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-12 lg:min-h-[calc(100vh-8rem)] lg:p-16">
        <header className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="size-2.5 bg-primary" />
          Easygo Mini Hackathon · Challenge 02
        </header>

        <div className="max-w-4xl">
          <TypographySmall className="mb-5 block font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            From chat to signal
          </TypographySmall>
          <TypographyH1 className="text-5xl leading-[0.9] font-bold uppercase sm:text-7xl lg:text-8xl">
            Chat insights
            <span className="block text-primary">&amp; engagement</span>
          </TypographyH1>
          <TypographyLead className="mt-8 max-w-2xl text-lg leading-8 sm:text-xl">
            Turn live chat into useful insight for streamers and meaningful
            participation for viewers.
          </TypographyLead>
        </div>

        <footer>
          <TypographyMuted className="mb-4 text-xs font-semibold uppercase tracking-[0.2em]">
            Stack ready
          </TypographyMuted>
          <ul className="flex flex-wrap gap-2">
            {stack.map((item) => (
              <li
                key={item}
                className="rounded-md border bg-muted px-3 py-1.5 text-sm font-medium text-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </footer>
      </section>
    </main>
  );
}
