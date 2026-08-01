"use client";

import { useState } from "react";
import { FlaskConical, Flame, MessageCircleQuestion, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

/** Floating demo controls — kept bottom-left, hidden during the pitch. */
export function DemoPanel() {
  const [open, setOpen] = useState(false);

  const trigger = (payload: Record<string, unknown>) =>
    void apiClient.post("/demo/trigger", payload);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-50 flex size-9 items-center justify-center rounded-full border bg-card/90 text-muted-foreground shadow-lg hover:text-foreground"
        title="Demo controls"
      >
        <FlaskConical className="size-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-52 rounded-xl border bg-card p-2.5 shadow-2xl shadow-black/50">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Demo controls
        </span>
        <button type="button" onClick={() => setOpen(false)}>
          <X className="size-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
      <div className="grid gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-8 justify-start gap-2 text-xs"
          onClick={() => trigger({ action: "hype" })}
        >
          <Flame className="size-3.5 text-orange-400" /> Hype spike
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 justify-start gap-2 text-xs"
          onClick={() => trigger({ action: "question_flood", topic: "sens" })}
        >
          <MessageCircleQuestion className="size-3.5 text-sky-400" /> Question flood
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 justify-start gap-2 text-xs"
          onClick={() => trigger({ action: "new_viewer" })}
        >
          <UserPlus className="size-3.5 text-primary" /> New viewer joins
        </Button>
      </div>
    </div>
  );
}
