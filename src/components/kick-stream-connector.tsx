"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, ExternalLink, PlugZap, X } from "lucide-react";

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
    <section className={cn("rounded-2xl border bg-card/90 p-3 shadow-sm", className)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            <PlugZap className="size-3.5" />
            Connect stream
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Paste a Kick stream link to target this UI.
          </p>
        </div>
        {stream ? (
          <Badge variant="outline" className="shrink-0">
            <CheckCircle2 className="size-3" />@{stream.slug}
          </Badge>
        ) : null}
      </div>

      <form className="flex gap-2" onSubmit={submit}>
        <Input
          aria-label="Kick stream URL"
          className="h-9 bg-background/70"
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          placeholder="https://kick.com/channel"
          value={value}
        />
        <Button className="h-9 shrink-0" type="submit">
          Connect
        </Button>
        {stream ? (
          <Button
            aria-label="Disconnect stream"
            className="size-9 shrink-0"
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
