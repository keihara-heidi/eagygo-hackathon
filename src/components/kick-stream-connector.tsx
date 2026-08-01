"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, ExternalLink, LinkIcon, PlugZap, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConnectedKickStream } from "@/hooks/use-connected-kick-stream";
import { cn } from "@/lib/utils";

interface KickStreamConnectorProps {
  className?: string;
}

export function KickStreamConnector({ className }: KickStreamConnectorProps) {
  const { stream, connect, disconnect } = useConnectedKickStream();
  const [value, setValue] = useState(stream?.url ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = connect(value);
    setError(result.ok ? null : result.error);
    if (result.ok) setValue(result.stream.url);
  }

  function clearConnection() {
    disconnect();
    setValue("");
    setError(null);
  }

  return (
    <section
      className={cn(
        "rounded-3xl border-2 border-primary/35 bg-card/95 p-4 shadow-lg shadow-primary/10",
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-primary">
            <PlugZap className="size-4" />
            Paste Kick stream link
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This is the stream target selector for the viewer + dashboard UI.
          </p>
        </div>
        {stream ? (
          <Badge variant="default" className="shrink-0">
            <CheckCircle2 className="size-3" />@{stream.slug}
          </Badge>
        ) : null}
      </div>

      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={submit}>
        <label className="relative block">
          <span className="sr-only">Kick stream URL</span>
          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
          <Input
            aria-label="Kick stream URL"
            className="h-12 rounded-2xl border-2 border-primary/30 bg-background pl-10 pr-4 text-base shadow-inner placeholder:text-muted-foreground/70 focus-visible:border-primary"
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            placeholder="https://kick.com/orbitfps"
            value={value}
          />
        </label>
        <Button className="h-12 rounded-2xl px-5 font-bold" type="submit">
          Connect
        </Button>
        {stream ? (
          <Button
            aria-label="Disconnect stream"
            className="size-12 shrink-0 rounded-2xl"
            onClick={clearConnection}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </form>

      <div className="mt-2 min-h-4 text-xs">
        {error ? (
          <p className="text-destructive" role="alert">{error}</p>
        ) : stream ? (
          <a
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
            href={stream.url}
            rel="noreferrer"
            target="_blank"
          >
            Connected target: {stream.url}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <p className="text-muted-foreground">
            Demo stream stays mocked until the webhook receiver is wired.
          </p>
        )}
      </div>
    </section>
  );
}
