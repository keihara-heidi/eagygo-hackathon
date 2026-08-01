"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, PlugZap, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  parseKickStreamLink,
  useConnectedKickStream,
} from "@/hooks/use-connected-kick-stream";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface KickStreamConnectorProps {
  className?: string;
}

interface KickStreamConnectResponse {
  stream: {
    slug: string;
    url: string;
    broadcaster_user_id: number;
    title: string;
    is_live: boolean;
    viewer_count: number;
  };
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { error?: unknown } } }).response;
    if (typeof response?.data?.error === "string") return response.data.error;
  }
  return error instanceof Error ? error.message : "Could not connect KICK stream";
}

export function KickStreamConnector({ className }: KickStreamConnectorProps) {
  const { stream, connect, disconnect } = useConnectedKickStream();
  const [value, setValue] = useState(stream?.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseKickStreamLink(value);
    if (!parsed) {
      setError("Paste a Kick channel URL like https://kick.com/orbitfps");
      return;
    }

    setIsConnecting(true);
    setError(null);
    try {
      const response = await apiClient.post<KickStreamConnectResponse>(
        "/kick/streams/connect",
        { slug: parsed.slug },
      );
      const result = connect(value, {
        broadcasterUserId: response.data.stream.broadcaster_user_id,
        isLive: response.data.stream.is_live,
        slug: response.data.stream.slug,
        title: response.data.stream.title,
        url: response.data.stream.url,
        viewerCount: response.data.stream.viewer_count,
      });
      setError(result.ok ? null : result.error);
      if (result.ok) setValue(result.stream.url);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsConnecting(false);
    }
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
          <Button className="h-8 shrink-0" disabled={isConnecting} type="submit">
            {isConnecting ? "Connecting…" : "Connect"}
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
            Resolves the KICK channel, subscribes webhook events, then filters this dashboard.
          </p>
        )}
      </div>
    </section>
  );
}
