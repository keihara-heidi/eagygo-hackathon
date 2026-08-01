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
          {stream ? (
            <Button
              aria-label="Disconnect stream"
              className="size-8 shrink-0"
              onClick={clearConnection}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </form>
      </div>

      <div className="min-h-4 text-[11px] sm:pl-42">
        {error ? (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        ) : stream ? (
          <a
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
            href={stream.url}
            rel="noreferrer"
            target="_blank"
          >
            Connected to @{stream.slug}
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
