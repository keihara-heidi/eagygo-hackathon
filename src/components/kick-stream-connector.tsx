"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, PlugZap, X } from "lucide-react";

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

  if (stream) {
    return (
      <section className={cn("flex items-center gap-2", className)}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          <PlugZap className="size-4 shrink-0 text-primary" />
          <p className="min-w-0 truncate text-xs font-semibold">
            Connected to @{stream.slug}
          </p>
        </div>
        <a
          aria-label={`Open @${stream.slug} on KICK`}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary"
          href={stream.url}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink className="size-3.5" />
        </a>
        <Button
          aria-label="Disconnect stream"
          className="shrink-0"
          onClick={clearConnection}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      </section>
    );
  }

  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-40 items-center gap-2">
          <PlugZap className="size-4 text-primary" />
          <div>
            <p className="text-xs font-semibold">Connect stream</p>
            <p className="text-[11px] text-muted-foreground">Target a KICK channel</p>
          </div>
        </div>

        <form className="flex min-w-0 flex-1 gap-2" onSubmit={submit}>
          <Input
            aria-label="Kick stream URL"
            className="h-8 bg-background"
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            placeholder="https://kick.com/channel"
            value={value}
          />
          <Button className="h-8 shrink-0" type="submit">
            Connect
          </Button>
        </form>
      </div>

      <div className="min-h-4 text-[11px] sm:pl-42">
        {error ? (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-muted-foreground">
            Demo stream stays mocked until the webhook receiver is wired.
          </p>
        )}
      </div>
    </section>
  );
}
