"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ChatComposerProps {
  disabled?: boolean;
  onSend: (message: string) => void;
}

export function ChatComposer({ disabled = false, onSend }: ChatComposerProps) {
  const [empty, setEmpty] = useState(true);
  const disabledRef = useRef(disabled);
  const sendRef = useRef(onSend);

  useEffect(() => {
    disabledRef.current = disabled;
    sendRef.current = onSend;
  }, [disabled, onSend]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        orderedList: false,
      }),
      Placeholder.configure({ placeholder: "Ask Sidekick anything…" }),
    ],
    editorProps: {
      attributes: {
        "aria-label": "Message Sidekick",
        "aria-multiline": "true",
        role: "textbox",
        class:
          "max-h-40 min-h-14 overflow-y-auto px-4 py-4 pr-16 text-[15px] leading-6 text-foreground focus:outline-none",
      },
      handleKeyDown: (_view, event) => {
        if (event.key !== "Enter" || event.shiftKey || event.isComposing) return false;
        event.preventDefault();

        const currentEditor = editor;
        const message = currentEditor?.getText({ blockSeparator: "\n" }).trim();
        if (!currentEditor || !message || disabledRef.current) return true;

        sendRef.current(message);
        currentEditor.commands.clearContent();
        return true;
      },
    },
    onCreate: ({ editor: currentEditor }) => setEmpty(currentEditor.isEmpty),
    onUpdate: ({ editor: currentEditor }) => setEmpty(currentEditor.isEmpty),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = editor?.getText({ blockSeparator: "\n" }).trim();
    if (!editor || !message || disabled) return;

    onSend(message);
    editor.commands.clearContent();
  }

  return (
    <form
      className="chat-editor relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/20 transition-colors focus-within:border-primary/50"
      onSubmit={submit}
    >
      <EditorContent editor={editor} />
      <Button
        aria-label="Send message"
        className="absolute bottom-2.5 right-2.5 size-9 rounded-xl"
        disabled={disabled || empty}
        size="icon"
        type="submit"
      >
        <ArrowUp className="size-4" />
      </Button>
    </form>
  );
}
