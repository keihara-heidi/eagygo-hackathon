"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";

const SUGGESTED_QUESTIONS = [
  "How's the stream?",
  "What have they been talking about?",
] as const;

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
      Placeholder.configure({ placeholder: "Message Sidekick" }),
    ],
    editorProps: {
      attributes: {
        "aria-label": "Message Sidekick",
        "aria-multiline": "true",
        role: "textbox",
        class:
          "max-h-40 min-h-11 overflow-y-auto px-3 py-2.5 pr-14 text-sm leading-6 text-foreground focus:outline-none",
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
    <div className="space-y-2">
      <div aria-label="Suggested questions" className="flex flex-wrap gap-2" role="group">
        {SUGGESTED_QUESTIONS.map((question) => (
          <Button
            key={question}
            className="rounded-full font-normal text-muted-foreground hover:text-foreground"
            disabled={disabled || !editor}
            onClick={() => editor?.chain().setContent(question).focus("end").run()}
            size="sm"
            type="button"
            variant="outline"
          >
            {question}
          </Button>
        ))}
      </div>
    <form
      className="chat-editor relative overflow-hidden rounded-lg border border-border bg-background transition-colors focus-within:border-primary/60"
      onSubmit={submit}
    >
      <EditorContent editor={editor} />
      <Button
        aria-label="Send message"
        className="absolute bottom-1.5 right-1.5 size-8 rounded-md"
        disabled={disabled || empty}
        size="icon"
        type="submit"
      >
        <ArrowUp className="size-4" />
      </Button>
    </form>
    </div>
  );
}
